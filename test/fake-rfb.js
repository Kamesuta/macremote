// Minimal RFB (VNC) server for tests: security type "None", a 64x48 solid-colour screen.
import net from 'node:net';

export function startFakeRfb(port = 0) {
  const sockets = new Set();
  let connections = 0;
  const server = net.createServer((sock) => {
    sockets.add(sock);
    connections += 1;
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    sock.write('RFB 003.008\n');
    let stage = 0;
    sock.on('data', (buf) => {
      if (stage === 0) { // client version -> offer security type 1 (None)
        stage = 1;
        sock.write(Buffer.from([1, 1]));
      } else if (stage === 1) { // client chose security type
        stage = 2;
        sock.write(Buffer.from([0, 0, 0, 0])); // SecurityResult OK
      } else if (stage === 2) { // ClientInit -> ServerInit
        stage = 3;
        const name = Buffer.from('fake');
        const init = Buffer.alloc(24 + name.length);
        init.writeUInt16BE(64, 0); init.writeUInt16BE(48, 2);
        // pixel format: 32bpp, depth 24, little-endian, true colour, 255 max, shifts 16/8/0
        init.set([32, 24, 0, 1], 4);
        init.writeUInt16BE(255, 8); init.writeUInt16BE(255, 10); init.writeUInt16BE(255, 12);
        init.set([16, 8, 0], 14);
        init.writeUInt32BE(name.length, 20);
        name.copy(init, 24);
        sock.write(init);
      } else {
        // Answer every FramebufferUpdateRequest (type 3) with one raw rectangle, solid red.
        for (let i = 0; i < buf.length;) {
          if (buf[i] === 3) {
            const w = 64, h = 48;
            const out = Buffer.alloc(4 + 12 + w * h * 4);
            out[0] = 0; out.writeUInt16BE(1, 2);
            out.writeUInt16BE(0, 4); out.writeUInt16BE(0, 6);
            out.writeUInt16BE(w, 8); out.writeUInt16BE(h, 10);
            out.writeInt32BE(0, 12); // raw encoding
            for (let p = 16; p < out.length; p += 4) { out[p] = 255; out[p + 1] = 0; out[p + 2] = 0; out[p + 3] = 0; } // noVNC requests R in byte 0
            sock.write(out);
            i += 10;
          } else if (buf[i] === 0) i += 20;       // SetPixelFormat
          else if (buf[i] === 2) i += 4 + 4 * buf.readUInt16BE(i + 2); // SetEncodings
          else if (buf[i] === 4) i += 8;          // KeyEvent
          else if (buf[i] === 5) i += 6;          // PointerEvent
          else break;
        }
      }
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    port: server.address().port,
    get connections() { return connections; },
    dropAll: () => sockets.forEach((s) => s.destroy()),
    close: () => new Promise((r) => { sockets.forEach((s) => s.destroy()); server.close(r); }),
  })));
}
