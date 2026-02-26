import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { NextRequest } from 'next/server';
import type { Readable } from 'stream';

const ALLOWED_VOICES = new Set([
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-XiaohanNeural',
  'zh-CN-YunyangNeural',
]);

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

export async function GET(req: NextRequest) {
  const text  = req.nextUrl.searchParams.get('text');
  const voice = req.nextUrl.searchParams.get('voice') ?? DEFAULT_VOICE;

  if (!text || text.trim().length === 0) {
    return new Response('Missing text parameter', { status: 400 });
  }

  const safeVoice = ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(safeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = await tts.toStream(text) as {
      audioStream: Readable;
      metadataStream: Readable | null;
    };

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Sanity check — return 500 so the client falls back to browser TTS
    if (audioBuffer.length === 0) {
      console.error(`[tts] Empty audio returned for voice=${safeVoice}`);
      return new Response('Empty audio from TTS service', { status: 500 });
    }

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err) {
    console.error('[tts] Edge-TTS error:', err);
    return new Response('TTS synthesis failed', { status: 500 });
  }
}
