// The qrcode package ships without types; only the SVG string API is used.
declare module 'qrcode' {
  const QRCode: { toString(text: string, options: { type: 'svg'; margin?: number; width?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; color?: { dark?: string; light?: string } }): Promise<string> }
  export default QRCode
}
