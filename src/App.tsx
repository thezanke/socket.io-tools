import { PrimaryButton, Stack, Text, TextField, useTheme } from '@fluentui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import JsonView from 'react-json-view';
import { io, Socket } from 'socket.io-client';
import { v4 } from 'uuid';
import './App.css';

const useSocket = (connectionString: string) => {
  const [socket, setSocket] = useState<Socket>();
  const [_isConnected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(connectionString);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [connectionString, setSocket]);

  return socket;
};

const defaultNewEvent = { eventName: '', messageBody: '' };

enum MessageOrigin {
  socket = 'socket',
  user = 'user',
}

type Message = { eventName: string; args: any[]; uuid: string; origin: MessageOrigin };

const MessageRow = (props: { message: Message; handleEventNameClick: (eventName: string) => void }) => {
  const { message, handleEventNameClick } = props;

  const theme = useTheme();

  const eventNameBgColor = useMemo(() => {
    if (message.origin === MessageOrigin.user) return theme.palette.neutralLighter;
    if (message.eventName === 'exception') return theme.palette.themeTertiary;
    return theme.palette.themeLight;
  }, [message]);

  const messageBody = useMemo(() => {
    if (!message.args.length) {
      return (
        <Text block variant="small" style={{ fontStyle: 'italic', padding: 5, maxWidth: '100%' }}>
          [empty]
        </Text>
      );
    }

    return <JsonView src={message.args} name="args" />;
  }, [message]);

  return (
    <tr>
      <td style={{ backgroundColor: eventNameBgColor, padding: 5, minWidth: 120 }} align="right">
        <Text
          style={{ fontWeight: 'bold', fontStyle: 'italic', cursor: 'pointer' }}
          onClick={() => handleEventNameClick(message.eventName)}
        >
          {message.eventName}
        </Text>
      </td>
      <td>{messageBody}</td>
    </tr>
  );
};

const getMessageBody = (messageBodyString: string) => {
  try {
    return JSON.parse(messageBodyString);
  } catch {
    return messageBodyString;
  }
};

const App = () => {
  const theme = useTheme();
  const [connectionString, updateConnectionString] = useState('ws://localhost:3000');
  const socket = useSocket(connectionString);
  const [messages, updateMessages] = useState<Message[]>([]);
  const [newEvent, updateNewEvent] = useState(defaultNewEvent);

  useEffect(() => {
    socket?.onAny((eventName, ...args) => {
      updateMessages((messages) => [...messages, { eventName, args, uuid: v4(), origin: MessageOrigin.socket }]);
    });
  }, [socket]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      const { eventName } = newEvent;
      const messageBody = getMessageBody(newEvent.messageBody);

      socket?.emit(eventName, messageBody);

      const args = messageBody && [messageBody];
      updateMessages((messages) => [...messages, { eventName, args, uuid: v4(), origin: MessageOrigin.user }]);

      updateNewEvent(defaultNewEvent);
    },
    [newEvent, updateNewEvent, socket]
  );

  const handleEventNameClick = useCallback(
    (eventName = '') => {
      updateNewEvent((prev) => ({ ...prev, eventName }));
    },
    [updateNewEvent]
  );

  const handleConnectionToggle = useCallback(() => {
    if (!socket) return;

    if (socket.connected) {
      socket.disconnect();
    } else {
      socket.connect();
    }
  }, [socket]);

  return (
    <Stack
      tokens={{ maxWidth: 800, childrenGap: 5 }}
      style={{ margin: '0 auto', position: 'relative', maxHeight: '90vh', minHeight: 500 }}
    >
      <Stack.Item>
        <Text variant="large">Socket.IO Tools</Text>
      </Stack.Item>
      <Stack.Item tokens={{ padding: 5 }} style={{ background: theme.palette.neutralLight }}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 5 }}>
          <Stack.Item>
            <TextField
              value={connectionString}
              onChange={(_e, newValue) => updateConnectionString(newValue ?? '')}
              style={{ width: 200 }}
            ></TextField>
          </Stack.Item>
          <Stack.Item grow>
            <Text style={{ cursor: 'pointer' }} onClick={handleConnectionToggle}>
              {socket?.connected ? '🟢 Connected' : '🔴 Disconnected'}
            </Text>
          </Stack.Item>
          {socket?.id && (
            <Stack.Item tokens={{ padding: 5 }}>
              <Text style={{ fontStyle: 'italic', color: theme.palette.neutralSecondaryAlt }}>ID: {socket.id}</Text>
            </Stack.Item>
          )}
        </Stack>
      </Stack.Item>
      <Stack.Item grow style={{ overflow: 'auto' }}>
        <table style={{ border: 0 }}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Args</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <MessageRow key={message.uuid} message={message} handleEventNameClick={handleEventNameClick} />
            ))}
          </tbody>
        </table>
      </Stack.Item>
      <Stack.Item>
        <Text style={{ cursor: 'pointer' }} onClick={() => updateMessages([])}>
          Clear
        </Text>
      </Stack.Item>
      <Stack.Item>
        <form>
          <Stack horizontal tokens={{ childrenGap: 5 }}>
            <Stack.Item>
              <TextField
                placeholder="Event Name"
                value={newEvent.eventName}
                onChange={(_e, newValue) => updateNewEvent((previous) => ({ ...previous, eventName: newValue ?? '' }))}
              />
            </Stack.Item>
            <Stack.Item grow>
              <TextField
                placeholder="Message Body"
                value={newEvent.messageBody}
                onChange={(_e, newValue) =>
                  updateNewEvent((previous) => ({ ...previous, messageBody: newValue ?? '' }))
                }
              />
            </Stack.Item>
            <Stack.Item>
              <PrimaryButton type="submit" onClick={handleSubmit}>
                Send
              </PrimaryButton>
            </Stack.Item>
          </Stack>
        </form>
      </Stack.Item>
    </Stack>
  );
};

export default App;
