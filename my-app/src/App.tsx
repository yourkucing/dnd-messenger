import { useState, useEffect, useRef } from "react";
import { supabase } from './supabaseClient';

type ChatMessage = {
  text: string;
  type: 'broadcast' | 'sent' | 'received';
  time?: string;
  date?: string;
  name?: string;
  sender_id?: string;
}

function groupMessagesByDate(messages: ChatMessage[]) {
  return messages.reduce<Record<string, ChatMessage[]>>((groups, message) => {
    const date = message.date || "Unknown date";
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});
}

function App() {
  const MAX_CHAR_LIMIT = 300;

  const [time, setTime] = useState("");
  const [chatAccessDisabled, setChatAccessDisabled] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [settingsPopup, setSettingsPopup] = useState(false);
  const groupedMessages = groupMessagesByDate(messages);
  const userIdRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});


  useEffect(() => {
    function updateTime() {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    }
    updateTime();
    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;

    const { error } = await supabase
      .from('settings')
      .update({ value: newValue })
      .eq('key', 'chat_access_disabled');

    if (error) {
      alert("Failed to update chat access setting.");
    }
  };

  const sendBroadcast = async () => {
    const message = broadcastMsg.trim().toUpperCase();
    if (!message || !userId) return;

    const user = JSON.parse(sessionStorage.getItem('user') || '{}');

    await supabase.from('messages').insert([
      {
        sender_id: userId,
        name: user.name || 'Anonymous',
        text: message,
        is_broadcast: true  //
      }
    ]);

    setBroadcastMsg("");
  };

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user?.id) {
      setUserId(user.id);
      setUserRole(user.role);
      userIdRef.current = user.id;
    }

    if (user.profile_picture) {
      setProfilePictureUrl(user.profile_picture);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchMessagesAndProfiles = async () => {
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .order('inserted_at', { ascending: true });

    if (!messagesData) return;

    setMessages(messagesData.map(msg => ({
      text: msg.text,
      name: msg.name,
      time: msg.inserted_at?.slice(11, 16),
      date: msg.inserted_at?.slice(0, 10),
      type: msg.is_broadcast ? 'broadcast' : (msg.sender_id === userId ? 'sent' : 'received'),
      sender_id: msg.sender_id,
    })));

    const senderIds = [...new Set(messagesData.map(m => m.sender_id))];

    const { data: usersData, error } = await supabase
      .from('users')
      .select('id, profile_picture')
      .in('id', senderIds);

    if (error) {
      console.error('Failed to fetch user profiles', error);
      return;
    }

    const profilesMap: Record<string, string> = {};
    usersData?.forEach(user => {
      profilesMap[user.id] = user.profile_picture || "https://placehold.co/200x200";
    });

    setUserProfiles(profilesMap);
  };

  fetchMessagesAndProfiles();

    const messageSubscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages(prev => [
            ...prev,
            {
              text: newMsg.text,
              name: newMsg.name,
              time: newMsg.inserted_at?.slice(11, 16),
              date: newMsg.inserted_at?.slice(0, 10),
              type: newMsg.is_broadcast ? 'broadcast' : (newMsg.sender_id === userIdRef.current ? 'sent' : 'received'),
            }
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [userId]);

  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || !userId || chatAccessDisabled || userRole === 'read-only') return;

    const user = JSON.parse(sessionStorage.getItem('user') || '{}');

    await supabase.from('messages').insert([
      {
        sender_id: userId,
        name: user.name || 'Anonymous',
        text: text
      }
    ]);

    setUserInput('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('user');
    setUserId(null);
    setUserRole(null);
    window.location.reload();
  };

  const openSettings = async () => {
    setSettingsPopup(true);
  };

  useEffect(() => {
    const fetchChatAccessSetting = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'chat_access_disabled')
        .single();

      if (!error && data) {
        setChatAccessDisabled(data.value);
      }
    };

    fetchChatAccessSetting();

    const settingsChannel = supabase
      .channel('chat-access-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.chat_access_disabled',
        },
        (payload) => {
          const newValue = payload.new.value;
          setChatAccessDisabled(newValue);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProfilePicture = async () => {
    if (!selectedFile || !userId) return;

    const fileExt = selectedFile.name.split('.').pop();
    const filePath = `${userId}/profile.${fileExt}`;

    await supabase.storage.from('profile-pictures').remove([filePath]);

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, selectedFile);

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      alert("Failed to upload image.");
      return;
    }

    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);

    const publicUrl = data?.publicUrl;

    if (publicUrl) {
      const { error: dbError } = await supabase
        .from('users')
        .update({ profile_picture: publicUrl })
        .eq('id', userId);

      if (dbError) {
        console.error("Failed to update profile picture in DB:", dbError);
        return;
      }

      setProfilePictureUrl(publicUrl);
      setSelectedFile(null);
      setPreviewUrl(null);

      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      sessionStorage.setItem('user', JSON.stringify({ ...user, profile_picture: publicUrl }));

      alert("Profile picture updated!");
    }
  };

  return (
    <>
    <div className="app-container">
      <button 
        onClick={handleLogout} 
        title="Logout"
        aria-label="Logout"
        className="logout-button"
      >
        <i className="material-icons">logout</i>
      </button>
      <button 
        onClick={openSettings} 
        title="Settings"
        aria-label="Settings"
        className="settings-button"
      >
        <i className="material-icons">settings</i>
      </button>
      {(userRole === 'admin' || userRole === 'dm') && (
        <div className="dm-controls">
            <h1>DM CONTROLS</h1>
            <label className="chat-access">
                <input 
                  type="checkbox" 
                  id="toggle-chat-access"
                  checked={chatAccessDisabled}
                  onChange={handleToggleChange} 
                />
                Toggle Chat Access
            </label>
            <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendBroadcast();
                    }}
                    >
            <label className="broadcast-message">
                Broadcast Message:
                <input 
                  type="text" 
                  placeholder="Type announcement"
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                />
                <button 
                >
                  SEND</button>
            </label>
            </form>
        </div>
      )}
      <div className="phone-body">
          <div className="speaker-slot"></div>
          <div className="mic-dots">
              <div></div><div></div><div></div>
          </div>
          <div className="phone-frame">
              <div className="header">
                  <span className="cell-connection">{time}</span>
                  <div className="right-header">
                      <i className="material-icons">signal_cellular_alt</i>
                      <i className="material-icons">wifi</i>
                      <i className="material-icons">battery_full</i>
                  </div>
              </div>
              <div className="messenger">
                  <div className="messenger-header">
                      <i className="material-icons back-icon">arrow_back</i>
                      <img src="https://placehold.co/40x40" alt="profile" className="chat-avatar" />
                      <span className="chat-title">HROOMS</span>
                      <span className="spacer"></span>
                      <i className="material-icons header-options">more_vert</i>
                  </div>
                  <div className="messenger-content" ref={chatBoxRef}>
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                      <div className="messenger-content2" key={date}>
                        <div className="date-separator">
                          {new Date(date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      {msgs.map((msg, idx) => {
                      if (msg.type === 'broadcast') {
                        return (
                          <div className="broadcast" key={idx}>
                            [BROADCAST] {msg.text}
                          </div>
                        );
                      }
                      return (
                        <div className={`bubble ${msg.type}`} key={idx}>
                          <img 
                            src={
                              msg.type === 'sent'
                                ? (profilePictureUrl || "https://placehold.co/200x200")
                                : (msg.sender_id && userProfiles[msg.sender_id]) || "https://placehold.co/200x200"
                            }
                            className="profile-bubbles" 
                          />
                          <div className="right-bubble">
                            <span className="name">{msg.type === 'sent' ? 'You' : msg.name}</span>
                            <span className="bubble-text">{msg.text}</span>
                            <span className="time">{msg.time || time}</span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  ))}
                  </div>
                  <div className="enter-text">
                      <div className="textarea-wrapper">
                          <textarea
                            value={userInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value.length <= MAX_CHAR_LIMIT) {
                                setUserInput(value);
                              } else if (value.length === MAX_CHAR_LIMIT + 1) {
                                alert(`Maximum character limit of ${MAX_CHAR_LIMIT} reached.`);
                              }
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text');
                              if ((userInput.length + pasted.length) > MAX_CHAR_LIMIT) {
                                e.preventDefault();
                                alert(`Pasting this would exceed the ${MAX_CHAR_LIMIT}-character limit.`);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                            disabled={chatAccessDisabled || userRole === 'read-only'}></textarea>
                          <div className="icons-inside">
                              <i className="material-icons">mic</i>
                              <i className="material-icons">image</i>
                          </div>
                      </div>
                      <button className="send-button" onClick={sendMessage}
                        disabled={chatAccessDisabled || userRole === 'read-only'}>
                          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="#0ff">
                          <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                          </svg>
                      </button>
                  </div>
              </div>
          </div>
      </div>
      {settingsPopup && (
      <>
          <div className="change-password-overlay" onClick={() => setSettingsPopup(false)} />
          <div className="change-password-popup">
              <h3>Settings</h3>
              <div className="profile-picture-section">
                <p>Change profile picture:</p>
                <img
                  src={previewUrl || profilePictureUrl || "https://placehold.co/100x100"}
                  alt="Profile Preview"
                  style={{ width: "100px", height: "100px", borderRadius: "50%" }}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicChange}
                />
              </div>

              <div className="settings-buttons">
                <button onClick={handleSaveProfilePicture} disabled={!selectedFile}>Save</button>
                <button onClick={() => {setSettingsPopup(false); setPreviewUrl(null);}}>Close</button>
              </div>
          </div>
      </>
      )}
    </div>
    </>
  )
}

export default App
