import React from 'react';
import InfoIcon from '@mui/icons-material/Info';
import CodeIcon from '@mui/icons-material/Code';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MemoryIcon from '@mui/icons-material/Memory';
import GavelIcon from '@mui/icons-material/Gavel';
import GitHubIcon from '@mui/icons-material/GitHub';

import { AppIcon } from '../components/ui/AppIcon';
import { VERSION } from '../States';

export default function About(props) {
  const { page } = props;

  return (
    <>
        {
        page==='about' &&
        <div style={{padding:'40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', height:'100%', overflowY: 'auto'}}>

        <AppIcon size={100} />

        <h1 style={{color:'#f8fafc', margin:'24px 0 8px 0', fontSize: '36px'}}>WABS</h1>
        <h2 style={{color:'#3b82f6', fontWeight:'600', margin:'0 0 32px 0', fontSize: '18px', letterSpacing: '1px'}}>WiZarD's Archival and Backup Search System</h2>

        <div style={{background:'#111827', padding:'32px', borderRadius:'16px', border:'1px solid #24324a', maxWidth: '600px', width: '100%', textAlign: 'left', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
            <div style={{background:'#8b5cf61a', padding:'10px', borderRadius:'10px', color:'#8b5cf6', display:'flex'}}><InfoIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Version Info</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Current Release: <strong style={{color: '#f8fafc'}}>v{VERSION}</strong></p>
            </div>
        </div>

        <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
            <div style={{background:'#10b9811a', padding:'10px', borderRadius:'10px', color:'#10b981', display:'flex'}}><CodeIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Developer</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 2px 0', fontSize: '14px'}}>Author: <strong style={{color: '#f8fafc'}}>Winny Mathew Kurian</strong></p>
            <p style={{color:'#94a3b8', margin: '0', fontSize: '14px'}}>Email: <a href="mailto:WiZarD.Devel@gmail.com" style={{color: '#3b82f6', textDecoration: 'none'}}>WiZarD.Devel@gmail.com</a></p>
            </div>
        </div>

        <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
            <div style={{background:'#f59e0b1a', padding:'10px', borderRadius:'10px', color:'#f59e0b', display:'flex'}}><AnalyticsIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Acknowledgements</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px', fontStyle: 'italic'}}>AI Assisted Development by ChatGPT, GitHub Copilot, Google Gemini (Pro), and Antigravity (DeepMind)</p>
            </div>
        </div>

        <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

        <div style={{display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px'}}>
            <div style={{background:'#0ea5e91a', padding:'10px', borderRadius:'10px', color:'#0ea5e9', display:'flex'}}><MemoryIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Open Source & AI Models</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 8px 0', fontSize: '14px'}}>WABS is powered by the following open-source projects and models:</p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6' }}>
                <li><b>Face Detection:</b> YuNet (OpenCV Zoo)</li>
                <li><b>Face Recognition:</b> SFace (OpenCV Zoo)</li>
                <li><b>Object Classification:</b> MobileNetV2 (ONNX Model Zoo)</li>
                <li><b>OCR (Text Recognition):</b> RapidOCR & PaddleOCR (ONNX)</li>
                <li><b>Core Tech:</b> Python, FastAPI, SQLite (FTS5), OpenCV, PyMuPDF, React, Vite, Material UI</li>
            </ul>
            </div>
        </div>

        <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
            <div style={{background:'#ef44441a', padding:'10px', borderRadius:'10px', color:'#ef4444', display:'flex'}}><GavelIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>License</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Released under the <strong style={{color: '#f8fafc'}}>MIT License</strong></p>
            </div>
        </div>

        <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <div style={{background:'#64748b1a', padding:'10px', borderRadius:'10px', color:'#64748b', display:'flex'}}><GitHubIcon /></div>
            <div>
            <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Source Code</h3>
            <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Available on <a href="https://github.com/wizwin/WABS" target="_blank" rel="noopener noreferrer" style={{color: '#3b82f6', textDecoration: 'none'}}>GitHub</a></p>
            </div>
        </div>

        </div>

        <div style={{marginTop:'32px', padding:'24px', background:'linear-gradient(90deg, #1e293b 0%, #111827 100%)', borderRadius:'12px', borderLeft: '4px solid #3b82f6', maxWidth: '600px', width: '100%', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
        <p style={{color:'#cbd5e1', margin:'0', lineHeight: '1.6', fontSize: '15px'}}>A modern, cross-platform archival system for managing and searching your digital backups with AI-powered categorization and 100% offline capabilities.</p>
        </div>

        </div>
        }
    </>
  );
}