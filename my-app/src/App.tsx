import { useState, useEffect, useRef } from "react";
import { supabase } from './supabaseClient';

type ChatMessage = {
  text: string;
  type: 'broadcast' | 'sent' | 'received';
  time?: string;
  date?: string;
  name?: string;
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
  const [time, setTime] = useState("");
  const [chatAccessDisabled, setChatAccessDisabled] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const groupedMessages = groupMessagesByDate(messages);

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

  const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatAccessDisabled(e.target.checked);
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
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('inserted_at', { ascending: true });

      if (data) {
        setMessages(data.map(msg => ({
          text: msg.text,
          name: msg.name,
          time: msg.inserted_at?.slice(11, 16),
          date: msg.inserted_at?.slice(0, 10),
          type: msg.is_broadcast ? 'broadcast' : (msg.sender_id === userId ? 'sent' : 'received'),
        })));
      }
    };

    fetchMessages();

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
              type: newMsg.is_broadcast ? 'broadcast' : (newMsg.sender_id === userId ? 'sent' : 'received'),
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
    if (!text || !userId) return;

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
                  <div className="messenger-content">
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                      <div className="messenger-content2" key={date} ref={chatBoxRef}>
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
                          <img src="https://placehold.co/200x200" className="profile-bubbles" />
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
                            onChange={(e) => setUserInput(e.target.value)}
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
    </div>
    </>
  )
}

export default App
