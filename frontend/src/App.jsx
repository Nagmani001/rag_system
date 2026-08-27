import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const SUGGESTIONS = [
  'Summarize the recent policy updates',
  'What are the community corrections policies?',
  'Find the latest transcripts from Johnson County',
]

let nextId = 0
const uid = () => `msg-${++nextId}`

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function sendMessage(promptOverride) {
    const prompt = (promptOverride ?? input).trim()
    if (!prompt || isStreaming) return

    const userMessage = { id: uid(), role: 'user', content: prompt }
    const assistantId = uid()
    const history = [...messages, userMessage]

    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setError(null)
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const payload = history.map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const append = (text) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + text } : m
          )
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          for (const line of event.split('\n')) {
            if (!line.startsWith('data: ')) continue
            let data
            try {
              data = JSON.parse(line.slice(6))
            } catch {
              continue
            }
            if (data.type === 'chunk' && data.text) {
              append(data.text)
            } else if (data.type === 'error') {
              throw new Error(data.error ?? 'Something went wrong')
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Generation stopped')
      } else {
        const message = err.message || 'Something went wrong'
        setError(message)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content ? { ...m, content: message } : m
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      textareaRef.current?.focus()
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleTextareaInput(e) {
    const el = e.target
    setInput(el.value)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="chat">
      <div className="chat-scroll">
        <div className="chat-content">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                  <path d="M12 2l2.4 4.8L19.5 9l-5.1 2.2L12 16l-2.4-4.8L4.5 9l5.1-2.2L12 2zm6.5 12l1.2 2.4 2.3 1-2.3 1L18.5 21l-1.2-2.4L15 17.6l2.3-1 1.2-2.4zM6 14l.9 1.8L8.7 16.6l-1.8.8L6 19.2l-.9-1.8-1.8-.8 1.8-.8L6 14z" />
                </svg>
              </div>
              <h1>How can I help you today?</h1>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.role}`}>
                  <div className="message-avatar" aria-hidden="true">
                    {m.role === 'user' ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <path d="M12 2l2.4 4.8L19.5 9l-5.1 2.2L12 16l-2.4-4.8L4.5 9l5.1-2.2L12 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="message-bubble">
                    {m.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: (props) => (
                            <a {...props} target="_blank" rel="noreferrer noopener" />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : isStreaming && m.role === 'assistant' ? (
                      <span className="cursor" aria-hidden="true" />
                    ) : (
                      ''
                    )}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </div>

      <div className="composer-area">
        <div className="composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              className="send-btn stop"
              onClick={stop}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              aria-label="Send message"
              title="Send message"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 4l-1.4 1.4 4.6 4.6H4v2h11.2l-4.6 4.6L12 18l6-6-6-6z" />
              </svg>
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <p className="disclaimer">
          Answers are generated by AI and may reference source documents. It can make
          mistakes — verify important information.
        </p>
      </div>
    </div>
  )
}

export default App
