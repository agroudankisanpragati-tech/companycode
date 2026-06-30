'use client';

import { useState, useEffect } from 'react';
import { FaFacebook, FaInstagram, FaYoutube } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { AiOutlinePlus, AiOutlineMinus } from 'react-icons/ai';
import { MdRefresh } from 'react-icons/md';

export default function TopBar() {
    const [zoom, setZoom] = useState(100);
    const [googleTranslateLoaded, setGoogleTranslateLoaded] = useState(false);

    useEffect(() => {
        // Load Google Translate widget
        if (document.getElementById('google-translate-script')) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;

        (window as any).googleTranslateElementInit = () => {
            new (window as any).google.translate.TranslateElement(
                {
                    pageLanguage: 'en',
                    includedLanguages: 'en,hi,pa,gu,ta,te,ka,ml,mr,bn,or,as',
                    layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
                    autoDisplay: true
                },
                'google_translate_element'
            );
            setGoogleTranslateLoaded(true);
        };

        document.head.appendChild(script);
    }, []);

    const handleZoomIn = () => {
        const newZoom = Math.min(zoom + 10, 150);
        setZoom(newZoom);
        document.documentElement.style.zoom = `${newZoom}%`;
    };

    const handleZoomOut = () => {
        const newZoom = Math.max(zoom - 10, 70);
        setZoom(newZoom);
        document.documentElement.style.zoom = `${newZoom}%`;
    };

    const handleResetZoom = () => {
        setZoom(100);
        document.documentElement.style.zoom = '100%';
    };

    return (
        <div className="topbar-root w-full bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg">
            <div className="section-container">
                <div className="flex justify-between items-center gap-2 py-1.5">
                    {/* Social Icons - hidden on very small screens */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold hidden sm:inline">Follow Us:</span>
                        <a
                            href="https://www.facebook.com/profile.php?id=61589122658245"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-white/20 touch-manipulation"
                            aria-label="Facebook"
                        >
                            <FaFacebook size={14} />
                        </a>
                        <a
                            href="https://x.com/agroudankisan"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-white/20 touch-manipulation"
                            aria-label="X"
                        >
                            <FaXTwitter size={14} />
                        </a>
                        <a
                            href="https://www.instagram.com/agroudankisanpragati/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-white/20 touch-manipulation hidden xs:flex"
                            aria-label="Instagram"
                        >
                            <FaInstagram size={14} />
                        </a>
                        <a
                            href="https://www.youtube.com/@AGROUDANKISANPRAGATI"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-white/20 touch-manipulation hidden sm:flex"
                            aria-label="YouTube"
                        >
                            <FaYoutube size={14} />
                        </a>
                    </div>

                    {/* Right side: Zoom + Translate */}
                    <div className="flex items-center gap-2">
                        {/* Zoom Controls - hidden on mobile to save space */}
                        <div className="hidden sm:flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <button
                                onClick={handleZoomOut}
                                className="p-1 hover:bg-white/30 rounded-full transition-colors duration-200 touch-manipulation"
                                title="Zoom Out"
                                aria-label="Zoom Out"
                            >
                                <AiOutlineMinus size={12} />
                            </button>
                            <span className="text-xs font-medium min-w-[32px] text-center">{zoom}%</span>
                            <button
                                onClick={handleZoomIn}
                                className="p-1 hover:bg-white/30 rounded-full transition-colors duration-200 touch-manipulation"
                                title="Zoom In"
                                aria-label="Zoom In"
                            >
                                <AiOutlinePlus size={12} />
                            </button>
                            <div className="h-3 w-px bg-white/30"></div>
                            <button
                                onClick={handleResetZoom}
                                className="p-1 hover:bg-white/30 rounded-full transition-colors duration-200 touch-manipulation"
                                title="Reset Zoom"
                                aria-label="Reset Zoom"
                            >
                                <MdRefresh size={12} />
                            </button>
                        </div>

                        {/* Google Translate Widget */}
                        <div
                            id="google_translate_element"
                            className="!text-white"
                        ></div>
                    </div>
                </div>
            </div>

            {/* Google Translate Styling */}
            <style jsx global>{`
                /* Keep topbar height fixed and prevent child widgets from expanding it */
                .topbar-root {
                    min-height: 36px;
                    overflow: hidden;
                }

                @media (max-width: 640px) {
                    .topbar-root {
                        min-height: 34px;
                    }
                }

                #google_translate_element {
                    font-size: 12px;
                    display: inline-flex !important;
                    align-items: center;
                    height: 28px !important;
                    line-height: 28px !important;
                    overflow: hidden;
                }
        
                .goog-te-gadget {
                    font-family: Arial, sans-serif;
                    color: white !important;
                    margin: 0 !important;
                    line-height: 1 !important;
                }
        
                .goog-te-gadget-simple {
                    background-color: transparent !important;
                    border: none !important;
                }
        
                /* Force the select to a consistent small height so it doesn't push layout */
                .goog-te-gadget-simple .goog-te-combo {
                    background-color: rgba(255, 255, 255, 0.12) !important;
                    color: white !important;
                    border: 1px solid rgba(255, 255, 255, 0.18) !important;
                    border-radius: 6px !important;
                    padding: 2px 8px !important;
                    font-size: 12px !important;
                    height: 26px !important;
                    line-height: 26px !important;
                    box-sizing: border-box !important;
                }

                .goog-te-gadget-simple .goog-te-combo:hover {
                    background-color: rgba(255, 255, 255, 0.18) !important;
                    border-color: rgba(255, 255, 255, 0.28) !important;
                }

                .goog-te-menu-value,
                .goog-te-menu-value span {
                    color: white !important;
                }

                .goog-te-gadget-simple .goog-te-combo option {
                    color: #333 !important;
                    background-color: white !important;
                }

                /* Hide google branding frames/logos that sometimes inject extra height */
                .goog-te-gadget .goog-te-logo-wrapper,
                .goog-logo-link,
                .goog-te-balloon,
                .goog-te-bottom-frame {
                    display: none !important;
                }

                /* If Google injects an iframe, keep it clipped */
                #google_translate_element iframe {
                    max-height: 0 !important;
                    width: 0 !important;
                    visibility: hidden !important;
                }
            `}</style>
        </div>
    );
}
