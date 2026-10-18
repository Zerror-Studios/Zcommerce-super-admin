import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui";

/** Pixel size of the rendered code; authenticator apps scan it comfortably at this size. */
const QR_SIZE_PX = 208;

export interface TotpQrCodeProps {
  /** The `otpauth://totp/...` URL from `platformEnrolMfa`. */
  otpauthUrl: string;
}

/**
 * The enrolment QR code (PRD-005 FR-1.4), drawn in the browser from the
 * otpauth URL so the secret never travels as an image. Only `otpauth:`
 * URLs are rendered (review C-L8). Black on white whatever the theme:
 * scanners need the contrast.
 */
export function TotpQrCode({ otpauthUrl }: TotpQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!otpauthUrl.startsWith("otpauth://")) {
      setFailed(true);
      return;
    }
    QRCode.toDataURL(otpauthUrl, { width: QR_SIZE_PX, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl]);

  if (failed) {
    return <p className="text-caption text-fg-muted">The QR code couldn't be drawn. Use the setup key below.</p>;
  }
  return (
    <div className="inline-flex rounded-card border border-line bg-white p-3">
      {dataUrl ? (
        <img src={dataUrl} width={QR_SIZE_PX} height={QR_SIZE_PX} alt="QR code to add Zcommerce to your authenticator app" />
      ) : (
        <Skeleton className="size-52" />
      )}
    </div>
  );
}
