export const metadata = {
  title: '基差套利工具',
  description: '展示币安所有币种的基差率和资金费率',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}