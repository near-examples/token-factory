const Config = {
    iceServers:[
        {url: 'stun:stun.l.google.com:19302'},
        {url: 'stun:stun1.l.google.com:19302'},
        {url: 'stun:stun2.l.google.com:19302'},
        {url: 'stun:stun3.l.google.com:19302'},
        {url: 'stun:stun4.l.google.com:19302'},
        {url: 'stun:stun.ekiga.net'},
        {url: 'stun:stun.ideasip.com'},
        {url: 'stun:stun.rixtelecom.se'},
        {url: 'stun:stun.schlund.de'},
        {url: 'stun:stun.stunprotocol.org:3478'},
        {url: 'stun:stun.voiparound.com'},
        {url: 'stun:stun.voipbuster.com'},
        {url: 'stun:stun.voipstunt.com'},
        {url: 'stun:stun.voxgratia.org'},
        {url: 'stun:23.21.150.121'},
    ]
};

const OfferOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

const ICETimeout = 1000;


export default class WebRTC {
    constructor() {
        this.peerConnection = new RTCPeerConnection(Config);
    }

    addStream(stream) {
        stream.getTracks().forEach(track => this.peerConnection.addTrack(track, stream));
    }

    gatherICECandidates() {
        return new Promise((resolve) => {
            setTimeout(resolve, ICETimeout);
            this.peerConnection.onicecandidate = (candidate) => {
                console.log("candidate", candidate);
                // We're waiting for all ICE candidates to gather before resolving this.
                if (candidate.candidate == null) {
                    resolve();
                }
            }
        });
    }

    async createOffer() {
        const gatherICECandidates = this.gatherICECandidates();
        const offer = await this.peerConnection.createOffer(OfferOptions);
        await this.peerConnection.setLocalDescription(offer);
        await gatherICECandidates;
        return this.peerConnection.localDescription;
    }

    async createAnswer(offer) {
        await this.peerConnection.setRemoteDescription(offer);
        const gatherICECandidates = this.gatherICECandidates();
        const answer = await this.peerConnection.createAnswer(OfferOptions);
        await this.peerConnection.setLocalDescription(answer);
        await gatherICECandidates;
        return this.peerConnection.localDescription;
    }

    async onAnswer(answer) {
        await this.peerConnection.setRemoteDescription(answer);
    }

    addOnTrackListener(callback) {
        this.peerConnection.addEventListener('track', callback);
    }

    close() {
        this.peerConnection.close();
    }
}
