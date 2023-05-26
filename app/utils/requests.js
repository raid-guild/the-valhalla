import axios from 'axios';

export const getValhallaFiles = async (signature) => {
  const data = await axios.post('/api/files', {
    signature
  });
  return data.data.response;
};

export const getValhallaFile = async (signature, key) => {
  const data = await axios.post('/api/channel', {
    key,
    signature
  });
  return data.data.channel;
};
