const HEADER_SIZE = 4;
const MAX_NATIVE_MESSAGE_SIZE = 64 * 1024 * 1024;

export function encodeNativeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.allocUnsafe(HEADER_SIZE + body.length);
  frame.writeUInt32LE(body.length, 0);
  body.copy(frame, HEADER_SIZE);
  return frame;
}

export class NativeMessageDecoder {
  #buffer = Buffer.alloc(0);

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const messages = [];

    while (this.#buffer.length >= HEADER_SIZE) {
      const bodyLength = this.#buffer.readUInt32LE(0);
      if (bodyLength > MAX_NATIVE_MESSAGE_SIZE) {
        throw new RangeError(`Native message exceeds ${MAX_NATIVE_MESSAGE_SIZE} bytes`);
      }

      const frameLength = HEADER_SIZE + bodyLength;
      if (this.#buffer.length < frameLength) {
        break;
      }

      const body = this.#buffer.subarray(HEADER_SIZE, frameLength);
      messages.push(JSON.parse(body.toString('utf8')));
      this.#buffer = this.#buffer.subarray(frameLength);
    }

    return messages;
  }
}
