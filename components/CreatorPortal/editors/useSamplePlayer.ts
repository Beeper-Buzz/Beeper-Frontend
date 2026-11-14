// Audition samples in the browser: decode once, play through a gain node so
// the creator hears the gain and pitch the app will use (root note vs a
// played note shifts the playback rate, as the Sampler does).

import { useCallback, useEffect, useRef, useState } from "react";

type Source = Blob | string;

export function useSamplePlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, Promise<AudioBuffer>>());
  const current = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx = () => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) throw new Error("This browser can't play audio previews.");
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  };

  const stop = useCallback(() => {
    try {
      current.current?.stop();
    } catch {
      // already stopped
    }
    current.current = null;
    setPlaying(null);
  }, []);

  const play = useCallback(
    async (
      key: string,
      source: Source,
      {
        gainDb = 0,
        semitones = 0
      }: { gainDb?: number; semitones?: number } = {}
    ) => {
      setError(null);
      try {
        const ac = ctx();
        if (ac.state === "suspended") await ac.resume();
        let buf = buffers.current.get(key);
        if (!buf) {
          buf = (async () => {
            const data =
              typeof source === "string"
                ? await (await fetch(source)).arrayBuffer()
                : await source.arrayBuffer();
            return ac.decodeAudioData(data);
          })();
          buffers.current.set(key, buf);
          buf.catch(() => buffers.current.delete(key));
        }
        const decoded = await buf;
        stop();
        const node = ac.createBufferSource();
        node.buffer = decoded;
        node.playbackRate.value = Math.pow(2, semitones / 12);
        const gain = ac.createGain();
        gain.gain.value = Math.pow(10, gainDb / 20);
        node.connect(gain).connect(ac.destination);
        node.onended = () => {
          if (current.current === node) {
            current.current = null;
            setPlaying(null);
          }
        };
        current.current = node;
        setPlaying(key);
        node.start();
      } catch (e) {
        setPlaying(null);
        setError(
          e instanceof Error && e.message
            ? `Couldn't play that file: ${e.message}`
            : "Couldn't play that file."
        );
      }
    },
    [stop]
  );

  const forget = useCallback((key: string) => {
    buffers.current.delete(key);
  }, []);

  useEffect(
    () => () => {
      try {
        current.current?.stop();
        ctxRef.current?.close().catch(() => undefined);
      } catch {
        // never throw from cleanup
      }
    },
    []
  );

  return { play, stop, playing, error, forget };
}
