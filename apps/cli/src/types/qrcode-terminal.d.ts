declare module "qrcode-terminal" {
  interface GenerateOptions {
    small?: boolean;
  }

  interface QrCodeTerminal {
    generate(input: string, options: GenerateOptions, callback: (output: string) => void): void;
  }

  const qrcode: QrCodeTerminal;
  export default qrcode;
}
