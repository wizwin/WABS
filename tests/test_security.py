import sys
import os
import unittest
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.utils.security import (
    hash_pin,
    verify_pin,
    check_lockout,
    record_failed_attempt,
    reset_failed_attempts,
    create_session,
    validate_session,
    revoke_session,
    revoke_all_sessions,
    redact_pii,
    is_security_pin_enabled,
    clear_thumbnail_cache
)
from backend.app.config import load_config, save_config
from backend.app.routes.auth import (
    get_auth_status,
    setup_pin,
    login_pin,
    change_pin,
    disable_pin,
    api_clear_cache,
    PinSetupRequest,
    PinLoginRequest,
    PinChangeRequest,
    PinDisableRequest
)
from fastapi import HTTPException

class DummyRequest:
    def __init__(self, client_ip="127.0.0.1", token=None, cookie_token=None, query_token=None):
        class Client:
            def __init__(self, host):
                self.host = host
        self.client = Client(client_ip)
        self.headers = {}
        self.cookies = {}
        self.query_params = {}
        if token:
            self.headers["X-Session-Token"] = token
        if cookie_token:
            self.cookies["wabs_session_token"] = cookie_token
        if query_token:
            self.query_params["token"] = query_token

class TestSecurityLayer(unittest.TestCase):
    def setUp(self):
        # Reset security config to disabled state before each test
        self.cfg = load_config()
        self.original_hash = self.cfg.get("security_pin_hash", "")
        self.original_salt = self.cfg.get("security_pin_salt", "")
        self.original_lan = self.cfg.get("allow_lan_access", False)

        self.cfg["security_pin_hash"] = ""
        self.cfg["security_pin_salt"] = ""
        self.cfg["allow_lan_access"] = False
        save_config(self.cfg)
        revoke_all_sessions()
        reset_failed_attempts("127.0.0.1")
        reset_failed_attempts("test-client")

    def tearDown(self):
        # Restore original configuration
        self.cfg["security_pin_hash"] = self.original_hash
        self.cfg["security_pin_salt"] = self.original_salt
        self.cfg["allow_lan_access"] = self.original_lan
        save_config(self.cfg)
        revoke_all_sessions()

    def test_pin_hashing_and_verification(self):
        pin = "SecurePIN1234"
        h_hex, s_hex = hash_pin(pin)
        self.assertTrue(bool(h_hex and s_hex))
        self.assertEqual(len(h_hex), 64) # SHA256 hex length
        self.assertEqual(len(s_hex), 32) # 16 bytes salt hex length

        # Verify correct PIN
        self.assertTrue(verify_pin(pin, h_hex, s_hex))

        # Verify wrong PIN
        self.assertFalse(verify_pin("WrongPIN", h_hex, s_hex))

        # Verify empty/invalid
        self.assertFalse(verify_pin("", h_hex, s_hex))
        self.assertFalse(verify_pin(pin, "", s_hex))

    def test_session_token_lifecycle(self):
        token = create_session("test-client")
        self.assertTrue(bool(token))
        self.assertTrue(validate_session(token))

        # Test invalid token
        self.assertFalse(validate_session("fake-token-12345"))
        self.assertFalse(validate_session(""))

        # Test revoking single session
        revoke_session(token)
        self.assertFalse(validate_session(token))

        # Test revoking all sessions
        token1 = create_session("client-1")
        token2 = create_session("client-2")
        self.assertTrue(validate_session(token1))
        self.assertTrue(validate_session(token2))
        revoke_all_sessions()
        self.assertFalse(validate_session(token1))
        self.assertFalse(validate_session(token2))

    def test_brute_force_rate_limiting(self):
        client_id = "test-client-rate-limit"
        reset_failed_attempts(client_id)

        # 4 failed attempts should not trigger lockout
        for _ in range(4):
            record_failed_attempt(client_id)
            locked, rem = check_lockout(client_id)
            self.assertFalse(locked)
            self.assertEqual(rem, 0)

        # 5th failed attempt triggers lockout
        record_failed_attempt(client_id)
        locked, rem = check_lockout(client_id)
        self.assertTrue(locked)
        self.assertGreater(rem, 0)

        # Resetting attempts clears lockout
        reset_failed_attempts(client_id)
        locked, rem = check_lockout(client_id)
        self.assertFalse(locked)

    def test_pii_redaction(self):
        text = "Hello, contact user at user.name@domain.com or phone +1 (555) 234-5678, IP: 192.168.1.50."
        redacted = redact_pii(text)
        self.assertNotIn("user.name@domain.com", redacted)
        self.assertIn("[EMAIL REDACTED]", redacted)
        self.assertNotIn("555", redacted)
        self.assertIn("[PHONE REDACTED]", redacted)
        self.assertNotIn("192.168.1.50", redacted)
        self.assertIn("[IP REDACTED]", redacted)

    def test_api_auth_flow(self):
        req_unauth = DummyRequest()
        
        # 1. Initially no PIN is set -> status shows pin_enabled: False
        res = get_auth_status(req_unauth)
        self.assertFalse(res["pin_enabled"])
        self.assertTrue(res["is_authenticated"])

        # 2. Setup PIN via API (verify non-numeric rejection and valid setup)
        with self.assertRaises(HTTPException) as ctx:
            setup_pin(PinSetupRequest(pin="abcde"), req_unauth)
        self.assertEqual(ctx.exception.status_code, 400)

        with self.assertRaises(HTTPException) as ctx:
            setup_pin(PinSetupRequest(pin="12"), req_unauth)
        self.assertEqual(ctx.exception.status_code, 400)

        setup_res = setup_pin(PinSetupRequest(pin="987654"), req_unauth)
        self.assertEqual(setup_res["status"], "success")
        self.assertIn("token", setup_res)
        session_token = setup_res["token"]

        # 3. Status with valid token vs without (test headers, cookies, and query params)
        status_with_token = get_auth_status(DummyRequest(token=session_token))
        self.assertTrue(status_with_token["pin_enabled"])
        self.assertTrue(status_with_token["is_authenticated"])

        status_with_cookie = get_auth_status(DummyRequest(cookie_token=session_token))
        self.assertTrue(status_with_cookie["is_authenticated"])

        status_with_query = get_auth_status(DummyRequest(query_token=session_token))
        self.assertTrue(status_with_query["is_authenticated"])

        status_without_token = get_auth_status(req_unauth)
        self.assertTrue(status_without_token["pin_enabled"])
        self.assertFalse(status_without_token["is_authenticated"])

        # 4. Test login with wrong PIN and non-numeric PIN
        with self.assertRaises(HTTPException) as ctx:
            login_pin(PinLoginRequest(pin="letters"), req_unauth)
        self.assertEqual(ctx.exception.status_code, 400)

        with self.assertRaises(HTTPException) as ctx:
            login_pin(PinLoginRequest(pin="000000"), req_unauth)
        self.assertEqual(ctx.exception.status_code, 401)

        # 5. Test login with correct PIN
        login_res = login_pin(PinLoginRequest(pin="987654"), req_unauth)
        self.assertEqual(login_res["status"], "success")
        new_token = login_res["token"]
        self.assertTrue(validate_session(new_token))

        # 6. Change PIN
        change_res = change_pin(
            PinChangeRequest(current_pin="987654", new_pin="123456"),
            DummyRequest(token=new_token)
        )
        self.assertEqual(change_res["status"], "success")
        changed_token = change_res["token"]

        # Old token should be invalidated
        self.assertFalse(validate_session(new_token))
        # New token should work
        self.assertTrue(validate_session(changed_token))

        # 7. Disable PIN
        disable_res = disable_pin(
            PinDisableRequest(current_pin="123456"),
            DummyRequest(token=changed_token)
        )
        self.assertEqual(disable_res["status"], "success")

        # Status should now be open
        final_status = get_auth_status(req_unauth)
        self.assertFalse(final_status["pin_enabled"])
        self.assertTrue(final_status["is_authenticated"])

if __name__ == "__main__":
    unittest.main()
