const id = Date.now()
let pc;
let localStreamElement = document.getElementById('localStream');
let remoteStreamElement = document.getElementById('remoteStream');
let lecturer = true
socket = new WebSocket(`ws://localhost:8000/ws/${id}`);
console.log("This is ws: ", socket)

var peerConfiguration = {};

(async() => {
  const response = await axios.get("https://first-webrtc-app.metered.live/api/v1/turn/credentials?apiKey=3e08a449e524357cc48147d16d2da0e6f960");
  const iceServers = response.data;
  peerConfiguration.iceServers = iceServers
})();

// var myPeerConnection = new RTCPeerConnection(peerConfiguration);

// THIS FUNCTION IS RESPONSIBLE FOR SENDING DATA TO THE SERVER
const sendData = (data) => {
    console.log("sending data");
    const jsonData = JSON.stringify({
        action: "data",
        user_id: id, // replace with actual user_id
        room: 8,
        data: data,
    });
    console.log(jsonData);  

    socket.send(jsonData);
    // socket.emit("data", {
    //     username: "localUsername",  // replace with actual username
    //     room: "roomName",  // replace with actual room name
    //     data: data,
    // });
};

// THE FIRST FUNCTION TO BE EXECUTED
const startConnection = () => {
    
    // navigator.mediaDevices
    //     .getUserMedia({
    //         audio: true,
    //         video: {
    //             height: 350,
    //             width: 350,
    //         },
    //     })
    //     .then((stream) => {
    //         localStreamElement.srcObject = stream;
    //         // socket.connect();
    //         let payload = JSON.stringify({
    //             action: "join", 
    //             user_id: id,
    //             room: 8
    //         })
    //         // socket.emit("join", { username: "localUsername", room: "roomName" });

    //         socket.send(payload)
    //     })
    //     .catch((error) => {
    //         console.error("Stream not found: ", error);
    //     });

    navigator.mediaDevices
        .getDisplayMedia({
            audio: true,  
            video: {
                height: 500,
                width: 500,
            }, 
        })
        .then((stream) => {
            localStreamElement.srcObject = stream;
            // socket.connect();
            let payload = JSON.stringify({
                action: "join", 
                user_id: id,
                room: 8
            })
            socket.send(payload)
        })
        .catch((error) => {
            console.error("Stream not found: ", error);
        });
};

// FUNTION IS RESPONSILE FOR SENDING ICE CANDIDATES TO THE SERVER WHICH THEN SENDS TO OTHER PEERS
const onIceCandidate = (event) => {
    // 8. Either of these peers can send ICE Candidates to the other on generation, with the help of the onicecandidate callback, and set the candidates received from the other using addIceCandidate().
    if (event.candidate) {
        sendData({
            type: "candidate",
            candidate: event.candidate,
        });
    }
};

const onTrack = (event) => {
    remoteStreamElement.srcObject = event.streams[0];
};


// FUNCTION IS RESPONSIBLE FOR CREATING RTCPEERCONNECTIONS
const createPeerConnection = () => {
    try {
        // 1. Peer A creates a RTCPeerConnection object for the connection.
        pc = new RTCPeerConnection(peerConfiguration);
        pc.onicecandidate = onIceCandidate;
        pc.ontrack = onTrack;

        const localStream = localStreamElement.srcObject;
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

        console.log("PeerConnection created");
    } catch (error) {
        console.error("PeerConnection failed: ", error);
    }
};

// THIS FUNCTION IS RESPONSIBLE FOR SENDING OFFERS FROM CLIENT TO SERVER WHICH THEN SENDS TO OTHER CLIENTS
const setAndSendLocalDescription = (sessionDescription) => {
    pc.setLocalDescription(sessionDescription)
        .then(() => {
            console.log("Local description set");
            // 3. Peer A now sends this offer in a stringified form to Peer B via a signaling server.
            // 6. Peer B now sends this answer in a stringified form to Peer A using a signaling server. In this case the type of the data would not be offer but answer
            sendData(sessionDescription);
        })
        .catch((error) => {
            console.error("Error setting local description: ", error);
        });
};


// THIS FUNCTION IS RESPONSIBLE FOR CREATING OFFERS BUT CALLS THE FINCTION THAT DOES THE ACTUAL SENDING OF THE OFFER
const sendOffer = () => {
    console.log("Sending offer");
    pc.createOffer()
    // 2. Peer A creates an offer SDP message with createOffer() and calls setLocalDescription() to set it as the local SDP description.
        .then(setAndSendLocalDescription)
        .catch((error) => {
            console.error("Send offer failed: ", error);
        });
};

// THIS FUNCTION IS RESPONSIBLE FOR CREATING ANSWERS BUT CALLS THE FUNCTION THAT DOES THE ACTUAL SENDING OF THE ANSWER
const sendAnswer = () => {
    // 5. Peer B creates an answer SDP message with createAnswer() and calls setLocalDescription() to set it as the local SDP description.
    // setLocalDescription is called in the function setAndSendLocalDescription
    console.log("Sending answer");
    pc.createAnswer()
        .then(setAndSendLocalDescription)
        .catch((error) => {
            console.error("Send answer failed: ", error);
        });
};

// THIS FUNCTION IS RESPONSIBLE FOR DECIDING WHAT TO DO WITH THE DATA THAT THE SERVER SENDS TO THE CLIENTS
const signalingDataHandler = (data) => {
    if (data.type === "offer") {
        // 4. Peer B is creating a RTCPeerConnection object and calls setRemoteDescription() with Peer A’s offer to know about its setup.
        createPeerConnection();
        pc.setRemoteDescription(new RTCSessionDescription(data))
            .then(() => {
                // 5. Peer B creates an answer SDP message with createAnswer() and calls setLocalDescription() to set it as the local SDP description.
                sendAnswer();
            })
            .catch((error) => {
                console.error("Error setting remote description for offer: ", error);
            });
    } else if (data.type === "answer") {
        // 7. Peer A calls setRemoteDescription() with the answer received in order to know about Peer B’s setup.
        pc.setRemoteDescription(new RTCSessionDescription(data))
            .catch((error) => {
                console.error("Error setting remote description for answer: ", error);
            });
    } else if (data.type === "candidate") {
        // 8. Either of these peers can send ICE Candidates to the other on generation, with the help of the onicecandidate callback, and set the candidates received from the other using addIceCandidate().
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch((error) => {
                console.error("Error adding ICE candidate: ", error);
            });
    } else {
        console.log("Unknown Data");
    }
};

// THIS ONE IS RESPONSIBLE FOR GETTING THE DATA THAT THE SERVER SENDS AND CALLING THE SIGNALING DATA HANDLER TO TAKE CARE OF THE REST
socket.onmessage = function(event) {
    var message = event.data
    
    try{
        // Attempt to parse the mesasage as JSON
        var jsonMessage = JSON.parse(message);
        if(jsonMessage.action == "ready"){
            console.log("Ready to connect");
            // 1. Peer A creates a RTCPeerConnection object for the connection.
            createPeerConnection();
            sendOffer();
        }

        else if(jsonMessage.action == "data"){
            console.log("Data received", jsonMessage.data)
            signalingDataHandler(jsonMessage.data)
        }

        }catch(e){
            // If parsing as JSON fails, treat it as a text message
            console.log("An error occured in parsing the json", e);
    }
}

// socket.on("ready", () => {
//     console.log("Ready to Connect!");
//     createPeerConnection();
//     sendOffer();
// });

// socket.on("data", (data) => {
//     console.log("Data received: ", data);
//     signalingDataHandler(data);
// });

// I DON'T KNOW WHAT THIS ONE DOES.
window.addEventListener("beforeunload", () => {
    if (pc) {
        pc.close();
    }
});

// Start the connection when the page loads
startConnection();