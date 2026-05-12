'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { lookupBarcode } from '@/lib/openfoodfacts';
import type { OffLookupResult } from '@/lib/openfoodfacts';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Called when the user successfully resolves a barcode (or types one in
   * manually) and OFF returns a usable result. The parent log modal uses this
   * to pre-populate the name + calories fields, then the user reviews + saves.
   *
   * For 'partial' results (product found but no calorie data) and 'not_found',
   * onResult is still called — parent populates what it can and shows the
   * remaining manual-entry fields.
   */
  onResult: (result: OffLookupResult) => void;
  /**
   * Called when the user explicitly clicks "Skip — type it in" to bail out of
   * the scan flow entirely and return to plain manual entry.
   */
  onSkipToManual: () => void;
}

type ScanState =
  | { mode: 'idle' }                                    // showing the "tap to scan" prompt
  | { mode: 'starting' }                                // requesting camera
  | { mode: 'scanning' }                                // camera live, looking for a code
  | { mode: 'looking_up'; barcode: string }             // OFF lookup in progress
  | { mode: 'error'; message: string; recoverable: boolean }; // camera or library error

/**
 * Phase 15c: barcode scan modal. Sub-modal opened from the log-entry modal.
 * Two paths:
 *   1. Live camera scan via @zxing/browser (dynamically imported)
 *   2. Manual UPC text entry (always visible as a fallback)
 * Plus a "Skip — type it in" button to bail out to the manual log form entirely.
 */
export function BarcodeScanModal({ open, onClose, onResult, onSkipToManual }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);

  const [scanState, setScanState] = useState<ScanState>({ mode: 'idle' });
  const [manualUpc, setManualUpc] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Stop the camera whenever the modal is closed or unmounted
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanState({ mode: 'idle' });
      setManualUpc('');
      setManualError(null);
    }
  }, [open]);

  const stopCamera = () => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch { /* noop */ }
      controlsRef.current = null;
    }
  };

  const handleStartScan = async () => {
    setScanState({ mode: 'starting' });
    try {
      // Dynamic import keeps zxing out of the initial nutrition-page bundle.
      const mod = await import('@zxing/browser');
      const reader = new mod.BrowserMultiFormatReader();

      // Wait one tick so the <video> element is rendered after state change
      // — handleStartScan transitions state to 'scanning' first, then mounts
      // the video element in the next render; we use a microtask hop here so
      // videoRef.current is populated by the time we use it.
      setScanState({ mode: 'scanning' });
      await new Promise<void>((r) => setTimeout(r, 50));

      if (!mountedRef.current) return;
      const videoEl = videoRef.current;
      if (!videoEl) {
        setScanState({ mode: 'error', message: 'Video element not ready. Try again.', recoverable: true });
        return;
      }

      // Prefer rear-facing (environment) on mobile.
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' } },
      };

      controlsRef.current = await reader.decodeFromConstraints(
        constraints,
        videoEl,
        (result, _err, controls) => {
          if (!result || !mountedRef.current) return;
          const text = result.getText();
          if (text) {
            controls.stop();
            controlsRef.current = null;
            handleBarcodeDetected(text);
          }
        }
      );
    } catch (err: unknown) {
      // Camera failures: permission denied, no camera, HTTPS issue, library load failure
      const message = err instanceof Error
        ? `${err.name === 'NotAllowedError'
            ? 'Camera permission denied. You can still type the barcode below.'
            : err.name === 'NotFoundError'
              ? 'No camera found on this device. You can still type the barcode below.'
              : err.message || 'Could not access the camera.'}`
        : 'Could not access the camera.';
      setScanState({ mode: 'error', message, recoverable: true });
    }
  };

  const handleBarcodeDetected = async (rawBarcode: string) => {
    setScanState({ mode: 'looking_up', barcode: rawBarcode });
    try {
      const result = await lookupBarcode(rawBarcode);
      if (!mountedRef.current) return;
      onResult(result);
      onClose();
    } catch (err: unknown) {
      // Network error — treat as not_found so user gets manual entry path
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Could not look up that barcode.';
      setScanState({ mode: 'error', message, recoverable: true });
    }
  };

  const handleManualLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const upc = manualUpc.trim();
    if (!upc) {
      setManualError('Enter a UPC barcode number.');
      return;
    }
    if (!/^\d{6,14}$/.test(upc)) {
      setManualError('That doesn\u2019t look like a barcode. UPCs are 8\u201314 digits.');
      return;
    }
    setManualBusy(true);
    setManualError(null);
    try {
      const result = await lookupBarcode(upc);
      onResult(result);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not look up that barcode.';
      setManualError(message);
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan a barcode"
      description="Point your camera at the product's barcode or type the number below."
      maxWidth="480px"
    >
      <div className="flex flex-col gap-4">

        {/* Camera area */}
        <div className="relative rounded-lg overflow-hidden bg-ink/95 aspect-[4/3] flex items-center justify-center">
          {scanState.mode === 'scanning' && (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                aria-label="Camera preview"
              />
              {/* Crosshair overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-1/3 border-2 border-paper/60 rounded-lg" />
              </div>
              <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-mono uppercase tracking-wider text-paper/80">
                Aim at the barcode
              </div>
            </>
          )}

          {scanState.mode === 'looking_up' && (
            <div className="text-center text-paper p-6">
              <div className="text-sm">Looking up</div>
              <div className="font-mono text-xs text-paper/60 mt-1">{scanState.barcode}</div>
            </div>
          )}

          {scanState.mode === 'starting' && (
            <div className="text-center text-paper p-6">
              <div className="text-sm">{'Starting camera\u2026'}</div>
            </div>
          )}

          {(scanState.mode === 'idle' || scanState.mode === 'error') && (
            <div className="text-center text-paper p-6 flex flex-col items-center gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                <path d="M3 6V4a1 1 0 011-1h2M3 18v2a1 1 0 001 1h2M21 6V4a1 1 0 00-1-1h-2M21 18v2a1 1 0 01-1 1h-2"/>
                <line x1="7" y1="7" x2="7" y2="17"/>
                <line x1="10" y1="7" x2="10" y2="17"/>
                <line x1="13" y1="7" x2="13" y2="17"/>
                <line x1="17" y1="7" x2="17" y2="17"/>
              </svg>
              {scanState.mode === 'error' ? (
                <div className="text-xs text-crimson-200 max-w-xs">{scanState.message}</div>
              ) : (
                <div className="text-xs opacity-80">Tap below to turn on your camera</div>
              )}
              <button
                type="button"
                onClick={handleStartScan}
                className="btn-primary !h-9 text-[12px] !px-4"
              >
                {scanState.mode === 'error' ? 'Try again' : 'Start camera'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          &mdash; or &mdash;
        </div>

        {/* Manual UPC fallback */}
        <form onSubmit={handleManualLookup} className="flex flex-col gap-2">
          <FormField label="Type UPC manually" help="The 8 to 14-digit barcode number on the package.">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={manualUpc}
              onChange={(e) => { setManualUpc(e.target.value); setManualError(null); }}
              placeholder="e.g. 722252100023"
              className="input-base"
            />
          </FormField>
          {manualError && <div className="text-xs text-crimson">{manualError}</div>}
          <button
            type="submit"
            disabled={manualBusy || !manualUpc.trim()}
            className="btn-secondary !h-9 text-[12px] !px-4 self-end"
          >
            {manualBusy ? 'Looking up\u2026' : 'Look up'}
          </button>
        </form>

        {/* Bail-out path */}
        <div className="flex justify-between items-center pt-3 border-t border-ink-hair">
          <button
            type="button"
            onClick={() => { onSkipToManual(); onClose(); }}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
          >
            Skip &mdash; type it in
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary !h-9 text-[12px] !px-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
