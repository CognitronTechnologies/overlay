import { WHATSAPP_URL } from './whatsapp';

/** WhatsApp glyph. */
function WhatsAppIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 01-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.42 9.42 0 01-1.44-5.02c0-5.2 4.24-9.43 9.46-9.43 2.53 0 4.9.99 6.69 2.78a9.36 9.36 0 012.77 6.67c0 5.2-4.24 9.44-9.46 9.44zm8.05-17.5A11.32 11.32 0 0012.04.5C5.77.5.68 5.58.68 11.84c0 2 .52 3.95 1.52 5.67L.6 23.5l6.14-1.61a11.34 11.34 0 005.3 1.35h.01c6.27 0 11.36-5.09 11.36-11.35 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  );
}

/**
 * Floating WhatsApp launcher, fixed to the bottom-right of every page like a
 * chat widget. Opens a WhatsApp conversation in a new tab.
 */
export default function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Chat with us on WhatsApp"
      title="Chat on WhatsApp"
    >
      <WhatsAppIcon />
      <span className="whatsapp-float__label">Chat with us</span>
    </a>
  );
}
