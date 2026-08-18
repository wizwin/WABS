import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import KeyIcon from '@mui/icons-material/Key';
import { API, setSessionToken } from '../../States';

export function LockScreen({ onUnlocked, initialStatus }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (initialStatus) {
      setIsSetupMode(!initialStatus.pin_enabled);
      if (initialStatus.lockout_remaining_seconds > 0) {
        setLockoutRemaining(initialStatus.lockout_remaining_seconds);
      }
    }
  }, [initialStatus]);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSetupMode, lockoutRemaining]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '');
    if (!cleanPin || lockoutRemaining > 0 || loading) return;

    if (!/^\d{4,12}$/.test(cleanPin)) {
      setError('PIN must be 4 to 12 digits (numbers only).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/auth/login`, { pin: cleanPin });
      if (res.data && res.data.token) {
        setSessionToken(res.data.token, true);
        setPin('');
        if (onUnlocked) onUnlocked();
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'Authentication failed.';
      
      if (status === 429) {
        const match = detail.match(/(\d+)\s+seconds/);
        if (match) {
          setLockoutRemaining(parseInt(match[1], 10));
        } else {
          setLockoutRemaining(300);
        }
        setError(detail);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '');
    const cleanConfirm = confirmPin.replace(/\D/g, '');
    if (!cleanPin || loading) return;

    if (!/^\d{4,12}$/.test(cleanPin)) {
      setError('PIN must be 4 to 12 digits (numbers only).');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError('PIN and Confirmation PIN do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API}/auth/setup`, { pin: cleanPin });
      if (res.data && res.data.token) {
        setSessionToken(res.data.token, true);
        setPin('');
        setConfirmPin('');
        if (onUnlocked) onUnlocked();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to setup PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumpadClick = (val) => {
    if (lockoutRemaining > 0) return;
    setPin((prev) => (prev + val).replace(/\D/g, '').slice(0, 12));
    if (inputRef.current) inputRef.current.focus();
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(11, 15, 25, 0.96)',
      backdropFilter: 'blur(12px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'inherit'
    }}>
      <div style={{
        backgroundColor: '#172033',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '32px 28px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        textAlign: 'center',
        color: '#f8fafc'
      }}>
        {/* Header Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#1e293b',
          border: '1px solid #3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          color: '#38bdf8'
        }}>
          {isSetupMode ? <SecurityIcon style={{ fontSize: '32px' }} /> : <LockOutlinedIcon style={{ fontSize: '32px' }} />}
        </div>

        <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '600' }}>
          {isSetupMode ? 'Set Security PIN' : 'WABS Archive Locked'}
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
          {isSetupMode
            ? 'Protect your personal archive with a 4 to 12 digit Master PIN.'
            : 'Enter your Master PIN (digits only) to unlock this session.'}
        </p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        {lockoutRemaining > 0 && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid #f59e0b',
            color: '#fcd34d',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            Account locked. Try again in <strong>{lockoutRemaining}s</strong>
          </div>
        )}

        <form onSubmit={isSetupMode ? handleSetup : handleLogin}>
          <div style={{ position: 'relative', marginBottom: isSetupMode ? '12px' : '20px' }}>
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder={isSetupMode ? 'Enter New PIN (digits only)' : 'Enter PIN (digits only)'}
              disabled={lockoutRemaining > 0 || loading}
              style={{
                width: '100%',
                padding: '12px 42px 12px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '16px',
                letterSpacing: showPassword ? 'normal' : '3px',
                boxSizing: 'border-box',
                outline: 'none',
                textAlign: 'center'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </button>
          </div>

          {isSetupMode && (
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirm New PIN (digits only)"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '16px',
                  letterSpacing: showPassword ? 'normal' : '3px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>
          )}

          {/* Quick Numpad for convenience */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '20px'
          }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleNumpadClick(digit)}
                disabled={lockoutRemaining > 0 || loading}
                style={{
                  padding: '10px 0',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setPin(''); setConfirmPin(''); }}
              disabled={lockoutRemaining > 0 || loading}
              style={{
                padding: '10px 0',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleNumpadClick('0')}
              disabled={lockoutRemaining > 0 || loading}
              style={{
                padding: '10px 0',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '16px',
                fontWeight: '600',
                cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer'
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={lockoutRemaining > 0 || loading}
              style={{
                padding: '10px 0',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ⌫
            </button>
          </div>

          <button
            type="submit"
            disabled={lockoutRemaining > 0 || loading || !pin.trim()}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (lockoutRemaining > 0 || loading || !pin.trim()) ? 'not-allowed' : 'pointer',
              opacity: (lockoutRemaining > 0 || loading || !pin.trim()) ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Verifying...' : isSetupMode ? 'Enable Security PIN' : 'Unlock Archive'}
          </button>
        </form>
      </div>
    </div>
  );
}
