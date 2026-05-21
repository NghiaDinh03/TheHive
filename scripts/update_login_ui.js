const fs = require('fs');
const path = require('path');

const cssFile = path.join(__dirname, '../platform/frontend/src/styles/globals.css');
let css = fs.readFileSync(cssFile, 'utf8');

const loginShellPattern = /\.ncs-login-shell \{[\s\S]*?\n\}/;
const loginCardPattern = /\.ncs-login-card \{[\s\S]*?\n\}/;
const loginHeaderPattern = /\.ncs-login-header \{[\s\S]*?\n\}/;
const loginBodyPattern = /\.ncs-login-body \{[\s\S]*?\n\}/;
const btnPrimaryPattern = /\.ncs-btn-primary \{[\s\S]*?\}\n\n\.ncs-btn-primary:hover:not\(:disabled\) \{[\s\S]*?\n\}/;

const newShell = `.ncs-login-shell {
  min-height: 100vh;
  background-color: #050b14; /* Nền tảng: NCS Fusion Center | Màu chủ đạo: Dark Navy Base */
  background-image: 
    linear-gradient(to bottom, rgba(5, 11, 20, 0.6), rgba(5, 11, 20, 0.95)),
    url('/bg-login.png');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 24px;
  position: relative;
}

.ncs-login-shell::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at 50% 30%, rgba(29, 78, 216, 0.15) 0%, transparent 60%); /* NCS Blue Glow */
  pointer-events: none;
}`;

const newCard = `.ncs-login-card {
  width: 100%;
  max-width: 480px; /* Form rộng hơn tạo cảm giác thoải mái, không gò bó */
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  z-index: 1;
}`;

const newHeader = `.ncs-login-header {
  background: rgba(255, 255, 255, 0.02);
  color: #ffffff;
  text-align: center;
  padding: 40px 32px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}`;

const newBody = `.ncs-login-body {
  padding: 36px 40px;
}`;

const newBtn = `.ncs-btn-primary {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); /* Nền tảng NCS Fusion Center | Màu chủ đạo nút bấm: NCS Blue (#1d4ed8) */
  color: #ffffff;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 14px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);
}

.ncs-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(29, 78, 216, 0.4);
}`;

css = css.replace(loginShellPattern, newShell);
css = css.replace(loginCardPattern, newCard);
css = css.replace(loginHeaderPattern, newHeader);
css = css.replace(loginBodyPattern, newBody);
css = css.replace(btnPrimaryPattern, newBtn);

fs.writeFileSync(cssFile, css, 'utf8');
console.log('Successfully updated globals.css with new NCS Fusion Center UI patterns.');
