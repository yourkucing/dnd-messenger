import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from './supabaseClient';
import { useAuth } from './AuthProvider';

interface User {
  id: string;
  needs_password_change?: boolean;
}

function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [terminalMsg, setTerminalMsg] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [loginMsg, setLoginMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [forceChangePassword, setForceChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [wrongPasswordPopup, setWrongPasswordPopup] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showPassword, setShowPassword] = useState(false);


    const terminalLines = [
        'SYSTEM INITIALIZED...',
        'ESTABLISHING LINK TO RHODES ISLAND HQ...',
        'AWAITING OPERATOR AUTHENTICATION...'
    ];

    const loginLines = [
        'INITIALIZING SECURE CONNECTION...',
        'AUTHENTICATING OPERATOR...',
        'CREDENTIALS VERIFIED.',
        `ACCESS GRANTED.\nWELCOME, ${username.toUpperCase() || 'OPERATOR'}.`
    ];

    const lineRef = useRef(0);
    const charRef = useRef(0);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const loginLineRef = useRef(0);
    const loginCharRef = useRef(0);
    const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        function typeLine() {
            if (lineRef.current >= terminalLines.length) {
                console.log("Typing complete");
                return;
            }

            const currentLine = terminalLines[lineRef.current];
            console.log(`Typing line ${lineRef.current}: "${currentLine}"`);

            if (charRef.current < currentLine.length) {
                const char = currentLine[charRef.current];
                console.log(`Appending char at index ${charRef.current}: "${char}"`);
                setTerminalMsg(prev => prev + char);
                charRef.current += 1;
                typingTimeoutRef.current = setTimeout(typeLine, 5);
            } else {
                console.log(`Line ${lineRef.current} done, moving to next line`);
                setTerminalMsg(prev => prev + '\n');
                lineRef.current += 1;
                charRef.current = 0;
                typingTimeoutRef.current = setTimeout(typeLine, 50);
            }
        }

        typeLine();

        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            console.log("Cleanup: cleared typing timeout");
        };
    }, []);

    const handleLogin = async () => {
        const { data: user, error } = await supabase.rpc('check_user_login', {
            input_username: username,
            input_password: password
        });

        console.log(error);
        console.log(user);

        if (error || !user || !user.id) {
            setWrongPasswordPopup(true);
            return;
        }

        setCurrentUser(user);

        if (user.needs_password_change) {
            setForceChangePassword(true);
            return;
        }

        if (user && user.id) {
            login(user);

            setShowPopup(true);
            setIsTyping(true);
            setLoginMsg('');
            
            loginLineRef.current = 0;
            loginCharRef.current = 0;

            function typeLogin(onComplete?: () => void) {
                if (loginLineRef.current >= loginLines.length) {
                    if (onComplete) onComplete();
                    return;
                }

                const currentLine = loginLines[loginLineRef.current];

                if (loginCharRef.current < currentLine.length) {
                    const char = currentLine[loginCharRef.current];
                    setLoginMsg(prev => prev + char);
                    loginCharRef.current += 1;
                    loginTimeoutRef.current = setTimeout(() => typeLogin(onComplete), 10);
                } else {
                    setLoginMsg(prev => prev + '\n');
                    loginLineRef.current += 1;
                    loginCharRef.current = 0;
                    loginTimeoutRef.current = setTimeout(() => typeLogin(onComplete), 100);
                }
            }

            typeLogin(() => navigate('/'));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
        setShowPopup(false);
        if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
        }
    };

    const handlePasswordChange = async() => {
        if (!currentUser) {
            alert("User not loaded.");
            return;
        }

        const { error } = await supabase.rpc('update_user_password', {
            input_id: currentUser.id,
            new_password: newPassword
        });

        if (error) {
            alert("Password change failed: " + error.message);
            return;
        }

        alert("Password updated. Please log in again.");
        sessionStorage.clear();
        setForceChangePassword(false);
        navigate('/');
    }

    return (
        <div className="app-container">
            <div onKeyDown={handleKeyDown} tabIndex={0}>
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleLogin();
                    }}
                    className="login-container"
                    >
                    <h1>Rhodes Island Login</h1>
                    <pre className="terminal-msg">{terminalMsg}</pre>
                    <input
                        type="text"
                        placeholder="Codename"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className={isTyping ? 'typing-caret' : ''}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                    />
                    <div className="password-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className={isTyping ? 'typing-caret' : ''}
                            onFocus={() => setIsTyping(true)}
                            onBlur={() => setIsTyping(false)}
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(prev => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            <i className="material-icons">
                            {showPassword ? "visibility_off" : "visibility"}
                            </i>
                        </button>
                    </div>
                    <button type="submit">Deploy</button>
                </form>
                <div className="footer">
                    <span>© Rhodes Island HQ - Tactical Operations Division</span><br />
                    <span>Network Link Secure - 2025</span>
                </div>

                <div className={`overlay ${showPopup ? '' : 'hidden'}`} />
                <div className={`terminal-popup ${showPopup ? '' : 'hidden'}`}>
                    <pre className="login-msg">{loginMsg}</pre>
                </div>
            </div>

            
            {forceChangePassword && (
            <>
                <div className="change-password-overlay" />
                <div className="change-password-popup">
                <h3>Change Your Password</h3>
                <div className="password-wrapper">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                    />
                    <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(prev => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        <i className="material-icons">
                        {showPassword ? "visibility_off" : "visibility"}
                        </i>
                    </button>
                </div>
                <button onClick={handlePasswordChange}>Update Password</button>
                </div>
            </>
            )}

            {wrongPasswordPopup && (
            <>
                <div className="change-password-overlay" onClick={() => setWrongPasswordPopup(false)} />
                <div className="change-password-popup">
                    <h3>Authentication Failed</h3>
                    <p>The codename or password is incorrect.<br />Please try again.</p>
                    <button onClick={() => setWrongPasswordPopup(false)}>Close</button>
                </div>
            </>
            )}
        </div>
    );
}

export default Login;