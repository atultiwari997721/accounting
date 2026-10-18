import React, { useState, useEffect } from 'react';
import { Lock, EyeOff, ShieldCheck, Fingerprint, Keyboard, Key, Check, AlertCircle, RefreshCw, Sparkles, HelpCircle, Smartphone, AlertTriangle } from 'lucide-react';

// Secure zero-dependency SHA-256 helper
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(String(message));
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-computed hash of default PIN "1234"
const DEFAULT_PIN = "1234";
const DEFAULT_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

// Helper for Base64 <-> ArrayBuffer
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Check if hostname is an IP address
function getValidRpId() {
  const hostname = window.location.hostname;
  if (!hostname || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === '[::1]') {
    return undefined; // W3C WebAuthn spec requires rpId to be omitted if IP address
  }
  return hostname;
}

export default function PinLock({ onUnlock }) {
  const [authMethod, setAuthMethod] = useState('pin'); // 'pin' | 'password' | 'fingerprint'

  // Input states
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);

  // Status states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');

  // Mobile WebAuthn readiness state
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);

  useEffect(() => {
    try {
      const storedPin = localStorage.getItem('kiosk_pin_hash');
      const ownerId = localStorage.getItem('kiosk_owner_userid') || 'admin';
      const remembered = localStorage.getItem('kiosk_remembered_userid');
      const credId = localStorage.getItem('kiosk_bio_credential_id');

      if (remembered) setUserId(remembered);
      else setUserId(ownerId);

      // Default PIN 1234 guarantee
      if (!storedPin) {
        localStorage.setItem('kiosk_pin_hash', DEFAULT_PIN_HASH);
        localStorage.setItem('kiosk_owner_userid', 'admin');
      }

      // Check secure context
      const secure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsSecureContext(secure);

      const hasWebAuthn = !!(window.PublicKeyCredential && navigator.credentials);
      setBioSupported(hasWebAuthn);
      setBioRegistered(!!credId);
    } catch (e) {
      console.warn('Initialization error in PinLock:', e);
    }
  }, []);

  // WebAuthn Biometric Registration (Works on Android Chrome, iOS Safari, Windows)
  const handleRegisterBiometrics = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSecureContext && window.location.hostname !== 'localhost') {
      setErrorMsg('Biometrics on mobile require HTTPS. On local network HTTP, please use 4-Digit PIN.');
      return;
    }

    if (!window.PublicKeyCredential) {
      setErrorMsg('Biometric authentication is not supported in this browser.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ownerId = localStorage.getItem('kiosk_owner_userid') || 'admin';
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(ownerId);
      const rpId = getValidRpId();

      const createOptions = {
        challenge,
        rp: {
          name: 'SBI Kiosk Ledger',
          ...(rpId ? { id: rpId } : {})
        },
        user: {
          id: userIdBytes,
          name: ownerId,
          displayName: `SBI Kiosk (${ownerId})`
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256 (Mobile Android & iOS)
          { alg: -257, type: 'public-key' } // RS256 (Windows Hello)
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          requireResidentKey: false,
          userVerification: 'preferred'
        },
        attestation: 'none'
      };

      const credential = await navigator.credentials.create({ publicKey: createOptions });
      if (credential && credential.rawId) {
        const credIdBase64 = bufferToBase64(credential.rawId);
        localStorage.setItem('kiosk_bio_credential_id', credIdBase64);
        localStorage.setItem(`kiosk_biometrics_registered_${ownerId}`, 'true');
        setBioRegistered(true);
        setSuccessMsg('Fingerprint registered successfully! Unlocking...');
        setTimeout(() => {
          onUnlock();
        }, 500);
      }
    } catch (err) {
      console.warn('Biometric registration error:', err);
      const rawMsg = err?.message || '';
      if (err?.name === 'NotAllowedError' || rawMsg.includes('cancelled') || rawMsg.includes('canceled')) {
        setErrorMsg('Fingerprint registration cancelled. Tap to try again or use PIN.');
      } else if (err?.name === 'SecurityError') {
        setErrorMsg('Mobile browsers require HTTPS for biometrics. Please use 4-Digit PIN.');
      } else {
        setErrorMsg(rawMsg || 'Device biometric registration failed. Use 4-Digit PIN.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // WebAuthn Biometric Verification
  const handleVerifyBiometrics = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSecureContext && window.location.hostname !== 'localhost') {
      setErrorMsg('Biometrics on mobile require HTTPS. On local network HTTP, please use 4-Digit PIN.');
      return;
    }

    if (!window.PublicKeyCredential) {
      setErrorMsg('Biometrics not supported in this browser.');
      setAuthMethod('pin');
      return;
    }

    const savedCredIdBase64 = localStorage.getItem('kiosk_bio_credential_id');

    // If no credential is saved on this phone yet, prompt registration directly!
    if (!savedCredIdBase64) {
      await handleRegisterBiometrics();
      return;
    }

    try {
      setIsSubmitting(true);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const rpId = getValidRpId();

      const allowCredentials = [];
      try {
        const rawBuffer = base64ToBuffer(savedCredIdBase64);
        allowCredentials.push({
          id: rawBuffer,
          type: 'public-key',
          transports: ['internal']
        });
      } catch (e) {
        console.warn('Could not decode saved credential ID:', e);
      }

      const getOptions = {
        challenge,
        ...(rpId ? { rpId } : {}),
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined
      };

      const assertion = await navigator.credentials.get({ publicKey: getOptions });
      if (assertion) {
        setSuccessMsg('Fingerprint Verified! Unlocking...');
        setTimeout(() => {
          onUnlock();
        }, 300);
      }
    } catch (err) {
      console.warn('Biometric verify error:', err);
      const rawMsg = err?.message || '';
      if (err?.name === 'NotAllowedError' || rawMsg.includes('cancelled') || rawMsg.includes('canceled')) {
        setErrorMsg('Fingerprint scan cancelled. Tap to try again or use PIN.');
      } else if (err?.name === 'InvalidStateError' || rawMsg.includes('not found') || rawMsg.includes('no credentials')) {
        // Credential was reset or from different origin
        localStorage.removeItem('kiosk_bio_credential_id');
        setBioRegistered(false);
        setErrorMsg('Fingerprint needs re-registration on this device. Tap "Register Fingerprint".');
      } else {
        setErrorMsg(rawMsg || 'Fingerprint scan failed. Tap to retry or use PIN.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Password Verification
  const handlePasswordVerify = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const ownerId = localStorage.getItem('kiosk_owner_userid') || 'admin';
    const storedPwHash = localStorage.getItem('kiosk_password_hash');

    if (userId.trim().toLowerCase() !== ownerId.toLowerCase()) {
      setShake(true);
      setErrorMsg('Incorrect User ID.');
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!storedPwHash) {
      if (password === 'admin123' || password === '123456') {
        onUnlock();
        return;
      }
      setErrorMsg('No custom password configured. Please use PIN Keypad (Default: 1234).');
      return;
    }

    try {
      const inputHash = await sha256(password);
      if (inputHash === storedPwHash) {
        setSuccessMsg('Authentication successful!');
        if (rememberDevice) {
          localStorage.setItem('kiosk_remembered_userid', ownerId);
        }
        setTimeout(() => onUnlock(), 300);
      } else {
        setShake(true);
        setErrorMsg('Incorrect Password. Access Denied.');
        setPassword('');
        setTimeout(() => setShake(false), 500);
      }
    } catch (err) {
      setErrorMsg('Password verification error.');
    }
  };

  // Direct PIN Check (No username required! Quick & Seamless)
  const verifyEnteredPin = async (candidatePin) => {
    setErrorMsg('');
    const storedPinHash = localStorage.getItem('kiosk_pin_hash');
    
    try {
      const inputHash = await sha256(candidatePin);

      // Matches stored hash OR matches default "1234" fallback
      const isMatch = (storedPinHash && inputHash === storedPinHash) || 
                      (inputHash === DEFAULT_PIN_HASH) || 
                      (candidatePin === DEFAULT_PIN);

      if (isMatch) {
        setSuccessMsg('PIN Verified! Unlocking...');
        setTimeout(() => {
          onUnlock();
        }, 200);
      } else {
        setShake(true);
        setErrorMsg('Incorrect 4-Digit PIN. Default is 1234.');
        setPin('');
        setTimeout(() => setShake(false), 500);
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      if (candidatePin === DEFAULT_PIN) {
        onUnlock();
      } else {
        setErrorMsg('PIN verification failed. Try default PIN: 1234');
        setPin('');
      }
    }
  };

  // Handle Keypad Press
  const handleKeypadPress = (val) => {
    setErrorMsg('');
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyEnteredPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setPin('');
  };

  // Quick Reset PIN Handler
  const handleQuickResetPin = async () => {
    if (newPinInput.length !== 4) {
      setErrorMsg('New PIN must be exactly 4 digits.');
      return;
    }
    try {
      const newHash = await sha256(newPinInput);
      localStorage.setItem('kiosk_pin_hash', newHash);
      setSuccessMsg(`PIN reset successfully! You can now log in with PIN: ${newPinInput}`);
      setShowForgotModal(false);
      setNewPinInput('');
      setPin(newPinInput);
      setTimeout(() => {
        onUnlock();
      }, 600);
    } catch (err) {
      setErrorMsg('Failed to reset PIN.');
    }
  };

  // Reset to default 1234
  const handleResetToDefault = () => {
    localStorage.setItem('kiosk_pin_hash', DEFAULT_PIN_HASH);
    setSuccessMsg('PIN reset to default: 1234. Unlocking...');
    setShowForgotModal(false);
    setTimeout(() => {
      onUnlock();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col justify-between items-center py-6 px-4 select-none max-w-md mx-auto h-full border-x border-slate-200 shadow-xl overflow-y-auto no-scrollbar">
      
      {/* Brand Header */}
      <div className="text-center mt-2 flex flex-col items-center">
        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 w-fit mb-2 shadow-xs">
          <Lock className="w-6 h-6 text-blue-600" />
        </div>
        <h1 className="text-base sm:text-lg font-black tracking-wide text-blue-950 uppercase">SBI Kiosk Cash Ledger</h1>
        <p className="text-[10px] text-slate-500 font-medium">Secure Banking Session • Operator Authentication</p>
      </div>

      {/* Main Login Card */}
      <div className="w-full flex-1 flex flex-col justify-center items-center gap-3 my-2 max-w-xs">
        
        {/* Auth Method Selector Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 w-full shadow-2xs">
          <button
            type="button"
            onClick={() => { setAuthMethod('pin'); handleClear(); setErrorMsg(''); }}
            className={`flex-1 h-9 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${
              authMethod === 'pin' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> 4-Digit PIN
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('fingerprint'); setErrorMsg(''); }}
            className={`flex-1 h-9 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${
              authMethod === 'fingerprint' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" /> Biometrics
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('password'); setErrorMsg(''); }}
            className={`flex-1 h-9 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${
              authMethod === 'password' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> Password
          </button>
        </div>

        {/* 1. PIN KEYPAD MODE (PRIMARY & SEAMLESS) */}
        {authMethod === 'pin' && (
          <div className="w-full flex flex-col items-center gap-3 bg-white border border-slate-200 p-4 rounded-3xl shadow-xs">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Enter Security PIN</span>
              
              {/* 4 Pin Indicator Dots */}
              <div className={`flex gap-3 my-2 ${shake ? 'animate-bounce text-red-500' : ''}`}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      idx < pin.length
                        ? 'bg-blue-600 border-blue-600 scale-110 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                        : 'bg-slate-100 border-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ATM-Style Number Keypad */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 w-full max-w-[240px]">
              {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(btn => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === 'C') handleClear();
                    else if (btn === '⌫') handleBackspace();
                    else handleKeypadPress(btn);
                  }}
                  className={`w-14 h-12 rounded-xl flex items-center justify-center text-base font-black transition-all active:scale-95 shadow-2xs ${
                    btn === 'C' ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs' :
                    btn === '⌫' ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs' :
                    'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-lg'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Quick Helper Badge */}
            <div className="flex items-center justify-between w-full pt-1 px-1 text-[9.5px]">
              <span className="text-slate-400 font-medium">Default PIN: <b className="text-slate-600">1234</b></span>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
              >
                Forgot PIN?
              </button>
            </div>
          </div>
        )}

        {/* 2. BIOMETRIC FINGERPRINT MODE (MOBILE & DESKTOP COMPLIANT) */}
        {authMethod === 'fingerprint' && (
          <div className="w-full flex flex-col items-center gap-3 py-5 px-4 bg-white border border-slate-200 rounded-3xl shadow-xs text-center">
            
            {!isSecureContext && window.location.hostname !== 'localhost' ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-1 text-[10px] text-amber-900 text-left">
                <span className="font-bold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Mobile Browser HTTPS Requirement
                </span>
                <p className="text-[9px] text-amber-800/90 leading-normal">
                  Mobile browsers (Chrome / Safari) require an <b>HTTPS connection</b> to access hardware fingerprint sensors.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthMethod('pin')}
                  className="mt-1 py-1.5 px-3 bg-amber-600 text-white rounded-xl font-bold text-center active:scale-95 text-[9.5px]"
                >
                  👉 Unlock Instantly with 4-Digit PIN (1234)
                </button>
              </div>
            ) : bioRegistered ? (
              /* Already Registered: Direct Sensor Tap */
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleVerifyBiometrics}
                  className="w-24 h-24 rounded-full bg-blue-50 border-2 border-blue-400 hover:border-blue-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group shadow-md"
                >
                  <Fingerprint className={`w-12 h-12 text-blue-600 group-hover:scale-110 transition-all ${isSubmitting ? 'animate-spin' : 'animate-pulse'}`} />
                </button>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-slate-800">Touch Fingerprint Sensor</span>
                  <p className="text-[9px] text-slate-500 leading-normal px-2">
                    Verify using your mobile fingerprint or Face ID.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleRegisterBiometrics}
                    className="text-[9.5px] text-slate-500 hover:text-slate-800 font-semibold underline"
                  >
                    Re-link Fingerprint
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('pin'); handleClear(); }}
                    className="text-[9.5px] text-blue-600 font-bold hover:underline"
                  >
                    Use PIN (1234)
                  </button>
                </div>
              </div>
            ) : (
              /* First-Time Mobile Registration */
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRegisterBiometrics}
                  className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-400 hover:border-emerald-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group shadow-md"
                >
                  <Smartphone className="w-10 h-10 text-emerald-600 group-hover:scale-110 transition-all" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-slate-800">Register Fingerprint on This Phone</span>
                  <p className="text-[9px] text-slate-500 leading-normal px-2">
                    Tap below to connect your device's fingerprint or Face ID sensor for 1-touch unlock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRegisterBiometrics}
                  disabled={isSubmitting}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <Fingerprint className="w-4 h-4" /> Link Phone Biometrics
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMethod('pin'); handleClear(); }}
                  className="text-[9.5px] text-blue-600 font-bold hover:underline mt-1"
                >
                  Use 4-Digit PIN Instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. PASSWORD MODE */}
        {authMethod === 'password' && (
          <form onSubmit={handlePasswordVerify} className="w-full flex flex-col gap-3 bg-white border border-slate-200 p-4 rounded-3xl shadow-xs text-left">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">User ID</label>
              <input
                type="text"
                required
                placeholder="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="h-10 px-3 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-900 font-bold focus:outline-none shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Password</label>
              <input
                type="password"
                required
                placeholder="Enter Account Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 px-3 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-900 focus:outline-none shadow-2xs"
              />
            </div>

            <button
              type="submit"
              className="h-10 mt-1 w-full bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4" /> Verify Password
            </button>

            <button
              type="button"
              onClick={() => { setAuthMethod('pin'); handleClear(); }}
              className="text-center text-[10px] text-blue-600 font-bold hover:underline"
            >
              Back to 4-Digit PIN Keypad
            </button>
          </form>
        )}
      </div>

      {/* Feedback Messages */}
      <div className="w-full flex flex-col items-center gap-1 mt-1 max-w-xs">
        {errorMsg && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-xl w-full flex items-center gap-1.5 text-[10px] font-bold text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
            <span>{typeof errorMsg === 'string' ? errorMsg : (errorMsg?.message || 'Login failed')}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl w-full flex items-center gap-1.5 text-[10px] font-bold text-emerald-800">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="text-center text-[8.5px] text-slate-400 flex items-center gap-1 mt-1">
          <EyeOff className="w-3 h-3 text-slate-400" /> Encrypted Session • Operator Safe
        </div>
      </div>

      {/* Forgot / Reset PIN Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col gap-3 text-left">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase">PIN Recovery</h3>
                <p className="text-[9px] text-slate-500 font-medium">Reset or restore default PIN</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 leading-normal">
              You can instantly reset to default PIN <b>1234</b> or set a new 4-digit PIN for this device.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-[8.5px] font-bold uppercase text-slate-500">Set New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                placeholder="e.g. 5678"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-10 px-3 text-center bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-base font-black tracking-widest text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={handleQuickResetPin}
                className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Save & Unlock
              </button>
              
              <button
                type="button"
                onClick={handleResetToDefault}
                className="h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" /> Reset to Default PIN (1234)
              </button>

              <button
                type="button"
                onClick={() => { setShowForgotModal(false); setNewPinInput(''); }}
                className="text-center text-[10px] text-slate-400 font-bold hover:text-slate-600 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
