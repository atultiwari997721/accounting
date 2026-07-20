import React, { useState, useEffect } from 'react';
import { Lock, EyeOff, ShieldCheck, Fingerprint, Keyboard, Key, Check, AlertCircle } from 'lucide-react';

// Secure zero-dependency SHA-256 helper
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function PinLock({ onUnlock }) {
  const [mode, setMode] = useState('verify'); // 'setup' | 'verify'
  const [authMethod, setAuthMethod] = useState('pin'); // 'pin' | 'password' | 'fingerprint'

  // Input states
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);

  // Status states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedBioAttempts, setFailedBioAttempts] = useState(0);
  const [shake, setShake] = useState(false);

  // Check if owner is already registered
  useEffect(() => {
    const ownerId = localStorage.getItem('kiosk_owner_userid');
    if (!ownerId) {
      setMode('setup');
    } else {
      setMode('verify');
      const remembered = localStorage.getItem('kiosk_remembered_userid');
      if (remembered) {
        setUserId(remembered);
      }
      
      // Auto-focus fingerprint if biometrics are supported and active
      const bioActive = localStorage.getItem(`kiosk_biometrics_registered_${ownerId}`);
      if (bioActive === 'true' && window.PublicKeyCredential) {
        setAuthMethod('fingerprint');
        // Trigger biometric challenge immediately on load
        setTimeout(() => {
          handleVerifyBiometrics(ownerId);
        }, 300);
      }
    }
  }, []);

  // WebAuthn Biometric Registration (Fingerprint / FaceID / PIN hello)
  const handleRegisterBiometrics = async (username) => {
    if (!window.PublicKeyCredential) {
      return false;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const createOptions = {
        challenge,
        rp: { name: "Kiosk Ledger" },
        rpId: window.location.hostname,
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        }
      };
      
      const credential = await navigator.credentials.create({ publicKey: createOptions });
      if (credential) {
        localStorage.setItem(`kiosk_biometrics_registered_${username}`, 'true');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('WebAuthn Registration Error:', err);
      return false;
    }
  };

  // WebAuthn Biometric Verification
  const handleVerifyBiometrics = async (forcedOwnerId) => {
    const ownerId = forcedOwnerId || localStorage.getItem('kiosk_owner_userid');
    if (!ownerId) return;

    setErrorMsg('');
    if (!window.PublicKeyCredential) {
      setErrorMsg('Biometrics not supported on this browser.');
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const getOptions = {
        challenge,
        rpId: window.location.hostname,
        timeout: 60000,
        userVerification: "required"
      };

      const assertion = await navigator.credentials.get({ publicKey: getOptions });
      if (assertion) {
        if (rememberDevice) {
          localStorage.setItem('kiosk_remembered_userid', ownerId);
        }
        onUnlock();
      }
    } catch (err) {
      console.error('Biometric authentication failed:', err);
      setShake(true);
      
      setFailedBioAttempts(prev => {
        const next = prev + 1;
        if (next >= 3) {
          setAuthMethod('pin');
          setErrorMsg('Biometrics failed 3 times. Shifting to PIN unlock.');
          return 0; // reset
        } else {
          setErrorMsg(`Biometrics verify failed (${next}/3 attempts).`);
          return next;
        }
      });

      setTimeout(() => setShake(false), 500);
    }
  };

  // Register account submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!userId.trim()) {
      setErrorMsg('User ID is required.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pwHash = await sha256(password);
      const pinHash = await sha256(pin);

      localStorage.setItem('kiosk_owner_userid', userId.trim());
      localStorage.setItem('kiosk_password_hash', pwHash);
      localStorage.setItem('kiosk_pin_hash', pinHash);

      if (rememberDevice) {
        localStorage.setItem('kiosk_remembered_userid', userId.trim());
      }

      setSuccessMsg('Registering account...');
      
      let bioDone = false;
      try {
        bioDone = await handleRegisterBiometrics(userId.trim());
      } catch (bioErr) {
        console.warn('Biometric setup failed or skipped:', bioErr);
      }

      if (bioDone) {
        setSuccessMsg('Account registered with biometric fingerprint protection!');
      } else {
        setSuccessMsg('Account created successfully with PIN & Password!');
      }

      setTimeout(() => {
        onUnlock();
      }, 1500);
    } catch (err) {
      setErrorMsg('Failed to setup password system.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login Verification submission
  const handleLoginVerify = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const ownerId = localStorage.getItem('kiosk_owner_userid');
    const storedPwHash = localStorage.getItem('kiosk_password_hash');
    const storedPinHash = localStorage.getItem('kiosk_pin_hash');

    if (!ownerId) {
      setMode('setup');
      return;
    }

    if (userId.trim().toLowerCase() !== ownerId.toLowerCase()) {
      setShake(true);
      setErrorMsg('Incorrect User ID.');
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (authMethod === 'password') {
      const inputHash = await sha256(password);
      if (inputHash === storedPwHash) {
        if (rememberDevice) {
          localStorage.setItem('kiosk_remembered_userid', ownerId);
        }
        onUnlock();
      } else {
        setShake(true);
        setErrorMsg('Incorrect Password. Access Denied.');
        setPassword('');
        setTimeout(() => setShake(false), 500);
      }
    } else if (authMethod === 'pin') {
      const inputHash = await sha256(pin);
      if (inputHash === storedPinHash) {
        if (rememberDevice) {
          localStorage.setItem('kiosk_remembered_userid', ownerId);
        }
        onUnlock();
      } else {
        setShake(true);
        setErrorMsg('Incorrect 4-Digit PIN.');
        setPin('');
        setTimeout(() => setShake(false), 500);
      }
    }
  };

  const handleKeypadPress = (val) => {
    setErrorMsg('');
    if (mode === 'setup') {
      if (pin.length < 4) {
        setPin(prev => prev + val);
      } else if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + val);
      }
    } else {
      if (pin.length < 4) {
        const nextPin = pin + val;
        setPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(async () => {
            const storedPinHash = localStorage.getItem('kiosk_pin_hash');
            const ownerId = localStorage.getItem('kiosk_owner_userid');
            const inputHash = await sha256(nextPin);
            if (userId.trim().toLowerCase() !== ownerId?.toLowerCase()) {
              setShake(true);
              setErrorMsg('Incorrect User ID.');
              setPin('');
              setTimeout(() => setShake(false), 500);
              return;
            }
            if (inputHash === storedPinHash) {
              if (rememberDevice) {
                localStorage.setItem('kiosk_remembered_userid', ownerId);
              }
              onUnlock();
            } else {
              setShake(true);
              setErrorMsg('Incorrect PIN.');
              setPin('');
              setTimeout(() => setShake(false), 500);
            }
          }, 150);
        }
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    if (mode === 'setup') {
      if (confirmPin.length > 0) {
        setConfirmPin(prev => prev.slice(0, -1));
      } else {
        setPin(prev => prev.slice(0, -1));
      }
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setErrorMsg('');
    setPin('');
    setConfirmPin('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between items-center py-8 px-6 select-none max-w-md mx-auto h-full border-x border-slate-900 shadow-2xl overflow-y-auto no-scrollbar">
      {/* Header / Brand */}
      <div className="text-center mt-2 flex flex-col items-center">
        <div className="p-3 bg-amber-500/10 rounded-full border border-amber-500/20 w-fit mb-2">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-lg font-extrabold tracking-wide text-slate-100 uppercase">Kiosk Cash Manager</h1>
        <p className="text-[10px] text-slate-400 mt-0.5">Device Protection & Ledger Encryption Active</p>
      </div>

      {mode === 'setup' ? (
        /* SETUP MODE FORM */
        <form onSubmit={handleRegisterSubmit} className="w-full flex-1 flex flex-col justify-center gap-3.5 my-4 text-left max-w-xs">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide text-center mb-1">Owner Registration</h2>
          
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Set User ID</label>
            <input
              type="text"
              required
              placeholder="e.g. admin"
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="h-10 px-3 bg-slate-900 border border-slate-850 focus:border-amber-500 rounded-xl text-xs text-slate-100 font-bold focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Set Account Password</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3 bg-slate-900 border border-slate-850 focus:border-amber-500 rounded-xl text-xs text-slate-100 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">4-Digit PIN</label>
              <input
                type="password"
                readOnly
                value={pin}
                placeholder="Type in Keypad"
                className="h-10 text-center bg-slate-900 border border-slate-850 rounded-xl text-xs text-slate-100 font-bold focus:outline-none placeholder:text-[10px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Confirm PIN</label>
              <input
                type="password"
                readOnly
                value={confirmPin}
                placeholder="Type in Keypad"
                className="h-10 text-center bg-slate-900 border border-slate-850 rounded-xl text-xs text-slate-100 font-bold focus:outline-none placeholder:text-[10px]"
              />
            </div>
          </div>

          {/* Setup keypad buttons */}
          <div className="grid grid-cols-3 gap-2 justify-items-center w-fit mx-auto mt-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-900">
            {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === 'C') handleClear();
                  else if (btn === '⌫') handleBackspace();
                  else handleKeypadPress(btn);
                }}
                className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-100 flex items-center justify-center text-sm font-bold active:scale-95 transition-all"
              >
                {btn}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-1 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="w-3.5 h-3.5 accent-amber-500 rounded border-slate-800 bg-slate-900"
            />
            <span className="text-[10px] text-slate-400 font-medium">Remember User ID on this device</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 mt-2 w-full bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" /> Save Account & Biometrics
          </button>
        </form>
      ) : (
        /* LOGIN / VERIFY OWNER MODE */
        <div className="w-full flex-1 flex flex-col justify-center items-center gap-4 my-2 max-w-xs">
          
          {/* Method tabs selector */}
          <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-900 w-full mb-1">
            <button
              onClick={() => { setAuthMethod('fingerprint'); setErrorMsg(''); handleVerifyBiometrics(); }}
              className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                authMethod === 'fingerprint' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" /> Fingerprint (Primary)
            </button>
            <button
              onClick={() => { setAuthMethod('pin'); handleClear(); setErrorMsg(''); }}
              className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                authMethod === 'pin' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> PIN Keypad (Secondary)
            </button>
            <button
              onClick={() => { setAuthMethod('password'); setErrorMsg(''); }}
              className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                authMethod === 'password' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" /> Password
            </button>
          </div>

          <form onSubmit={handleLoginVerify} className="w-full flex flex-col gap-3 text-left">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">User ID</label>
              <input
                type="text"
                required
                placeholder="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="h-10 px-3 bg-slate-900 border border-slate-850 focus:border-amber-500 rounded-xl text-xs text-slate-100 font-bold focus:outline-none"
              />
            </div>

            {authMethod === 'password' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 px-3 bg-slate-900 border border-slate-850 focus:border-amber-500 rounded-xl text-xs text-slate-100 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-11 mt-3 w-full bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  Verify Password
                </button>
              </div>
            )}

            {authMethod === 'pin' && (
              <div className="flex flex-col items-center gap-3">
                {/* Indicators */}
                <div className={`flex gap-4 my-1 ${shake ? 'animate-bounce text-red-500' : ''}`}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-100 ${
                        idx < pin.length
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'bg-transparent border-slate-700'
                      }`}
                    />
                  ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-900">
                  {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(btn => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => {
                        if (btn === 'C') handleClear();
                        else if (btn === '⌫') handleBackspace();
                        else handleKeypadPress(btn);
                      }}
                      className="w-12 h-12 rounded-full bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:border-slate-700 text-slate-100 flex items-center justify-center text-lg font-extrabold active:scale-95 transition-all"
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {authMethod === 'fingerprint' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <button
                  type="button"
                  onClick={handleVerifyBiometrics}
                  className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 hover:border-amber-500 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group"
                >
                  <Fingerprint className="w-10 h-10 text-amber-400 group-hover:scale-110 transition-all animate-pulse" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-300 font-semibold">Touch Fingerprint Sensor</span>
                  <span className="text-[8px] text-slate-500 leading-normal px-4">Verify using device biometrics (Windows Hello, FaceID, or TouchID)</span>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Footer message / feedback */}
      <div className="w-full flex flex-col items-center gap-1.5 mt-2 max-w-xs">
        {errorMsg && (
          <p className="text-[10px] font-semibold text-red-400 flex items-center gap-1 text-center leading-normal">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 text-center leading-normal">
            <Check className="w-3.5 h-3.5 shrink-0" /> {successMsg}
          </p>
        )}
        <div className="text-center text-[8px] text-slate-600 flex items-center gap-1 mt-1">
          <EyeOff className="w-2.5 h-2.5" /> Screen shielded. Passwords and biometrics are stored locally.
        </div>
      </div>
    </div>
  );
}
