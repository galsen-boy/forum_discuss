import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  AppBar,
  Toolbar,
  Divider,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';

interface Discussion {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  is_bot: boolean;
  username: string;
}

const TeacherDashboard: React.FC = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [openDiscussionDialog, setOpenDiscussionDialog] = useState(false);
  const { logout } = useAuth();

  const fetchDiscussions = async () => {
    try {
      const response = await axios.get(`${API_URL}/discussions`);
      setDiscussions(response.data);
    } catch (error) {
      console.error('Error fetching discussions:', error);
    }
  };

  const fetchMessages = async (discussionId: number) => {
    try {
      const response = await axios.get(`${API_URL}/discussions/${discussionId}/messages`);
      console.log('Received messages:', response.data);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  const handleCreateDiscussion = async () => {
    try {
      await axios.post(`${API_URL}/discussions`, {
        title: newTitle,
        content: newContent,
      });
      setOpenDialog(false);
      setNewTitle('');
      setNewContent('');
      fetchDiscussions();
    } catch (error) {
      console.error('Error creating discussion:', error);
    }
  };

  const handleDiscussionClick = (discussion: Discussion) => {
    setSelectedDiscussion(discussion);
    setOpenDiscussionDialog(true);
    fetchMessages(discussion.id);
  };

  const handleSendMessage = async () => {
    if (!selectedDiscussion || !newMessage.trim()) return;

    try {
      await axios.post(`${API_URL}/discussions/${selectedDiscussion.id}/messages`, {
        content: newMessage,
      });
      setNewMessage('');
      fetchMessages(selectedDiscussion.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Teacher Dashboard
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Discussions
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenDialog(true)}
          >
            Create New Discussion
          </Button>
        </Box>

        <Paper elevation={3}>
          <List>
            {discussions.map((discussion) => (
              <ListItem
                key={discussion.id}
                onClick={() => handleDiscussionClick(discussion)}
                divider
                sx={{ cursor: 'pointer' }}
              >
                <ListItemText
                  primary={discussion.title}
                  secondary={
                    <>
                      <Typography component="span" variant="body2">
                        {discussion.content}
                      </Typography>
                      <br />
                      <Typography component="span" variant="caption">
                        Created: {new Date(discussion.created_at).toLocaleString()}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>Create New Discussion</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Title"
              fullWidth
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <TextField
              margin="dense"
              label="Content"
              fullWidth
              multiline
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateDiscussion} variant="contained">
              Create
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openDiscussionDialog}
          onClose={() => setOpenDiscussionDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {selectedDiscussion?.title}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedDiscussion?.content}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>
                Messages
              </Typography>
              {messages.map((message) => (
                <Paper
                  key={message.id}
                  elevation={1}
                  sx={{
                    p: 2,
                    mb: 2,
                    backgroundColor: message.is_bot ? '#f5f5f5' : 'white',
                  }}
                >
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                    {message.username}
                  </Typography>
                  <Typography variant="body1">{message.content}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(message.created_at).toLocaleString()}
                  </Typography>
                </Paper>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="Your message"
                multiline
                rows={2}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type @bot to get a response from the bot"
              />
              <Button
                variant="contained"
                onClick={handleSendMessage}
                sx={{ alignSelf: 'flex-end' }}
              >
                Send
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDiscussionDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
};

export default TeacherDashboard; 