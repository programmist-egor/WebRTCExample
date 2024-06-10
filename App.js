import React, { useEffect, useRef, useState } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { Camera } from 'expo-camera';
import io from 'socket.io-client';
import { RTCPeerConnection, RTCView, mediaDevices } from 'react-native-webrtc';

const socket = io('http://localhost:4000'); // Замените на URL вашего сигнального сервера

const MyVideoApp = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [cameraType, setCameraType] = useState(Camera.Constants.Type.back);
  const peerConnection = useRef(new RTCPeerConnection());

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();

    const startStream = async () => {
      const stream = await mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      peerConnection.current.addStream(stream);
    };

    socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socket.on('offer', async (sdp) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answer', peerConnection.current.localDescription);
    });

    socket.on('candidate', async (candidate) => {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    });

    peerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('candidate', candidate);
      }
    };

    peerConnection.current.onaddstream = ({ stream }) => {
      setLocalStream(stream);
    };

    startStream();
  }, []);

  const startBroadcast = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('offer', peerConnection.current.localDescription);
  };

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
      <View style={styles.container}>
        <View style={styles.cameraContainer}>
          {localStream && (
              <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.streamView}
              />
          )}
        </View>
        <Button title="Начать трансляцию" onPress={startBroadcast} />
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  streamView: {
    width: '100%',
    height: '100%',
  },
});

export default MyVideoApp;
