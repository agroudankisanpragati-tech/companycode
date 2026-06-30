'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchPublishedGallery, type GalleryItem } from '@/services/gallery';

export default function VideoBanner() {
  const [videos, setVideos] = useState<GalleryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    let mounted = true;
    void fetchPublishedGallery()
      .then((items) => {
        if (!mounted) return;
        const onlyVideos = items.filter((i) => i.mediaType === 'video');
        const orderedVideos = [
          ...onlyVideos.filter((i) => i.featured),
          ...onlyVideos.filter((i) => !i.featured),
        ].slice(0, 5);
        setVideos(orderedVideos);
        setCurrentIndex(0);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (videos.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [videos.length]);

  useEffect(() => {
    const activeVideo = videoRefs.current[currentIndex];
    if (!activeVideo) return;

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index !== currentIndex) {
        video.pause();
      }
    });

    activeVideo.currentTime = 0;

    const attemptPlay = async (tries = 0) => {
      try {
        await activeVideo.play();
      } catch {
        if (tries < 3) {
          // retry after a short delay — mobile browsers sometimes need a bit more time
          setTimeout(() => void attemptPlay(tries + 1), 250);
        }
      }
    };

    // try immediately and also when metadata is loaded
    void attemptPlay();
    const onLoaded = () => void attemptPlay();
    activeVideo.addEventListener('loadeddata', onLoaded);
    return () => {
      activeVideo.removeEventListener('loadeddata', onLoaded);
    };
  }, [currentIndex, videos]);

  return (
    <section className="w-full h-[40vh] sm:h-[55vh] md:h-[65vh] lg:h-[78vh] overflow-hidden relative py-0">
      {videos.length > 0 ? (
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {videos.map((video, index) => (
            <video
              key={video._id}
              ref={(element) => {
                videoRefs.current[index] = element;
              }}
              src={video.mediaUrl}
              className="w-full h-full min-w-full object-center object-cover"
              playsInline
              muted
              autoPlay={index === currentIndex}
              loop={false}
              preload="metadata"
            />
          ))}
        </div>
      ) : (
        <div className="w-full h-full bg-black" />
      )}

      {videos.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {videos.map((video, index) => (
            <button
              key={`${video._id}-dot`}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to video ${index + 1}`}
              className={`h-2.5 w-2.5 rounded-full transition ${
                index === currentIndex ? 'bg-white' : 'bg-white/45'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
