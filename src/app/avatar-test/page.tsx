import AvatarTestApp from '@/components/avatar-test/AvatarTestApp';

export default function AvatarTestPage() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-semibold text-stone-900">
          Avatar 3D — số đo cơ thể &amp; mặc thử (Phase 1 POC)
        </h1>
        <p className="text-xs text-stone-500">
          Trang độc lập, không dùng chung state với fitting room chính.
        </p>
      </header>

      <main className="flex-1">
        <AvatarTestApp />
      </main>

      <footer className="border-t border-stone-200 bg-white px-4 py-3 text-center text-[11px] text-stone-400">
        Mesh &amp; morph data derived from{' '}
        <a
          href="http://www.makehumancommunity.org/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          MakeHuman
        </a>{' '}
        (CC0 1.0 Universal). See tools/avatar-pipeline/PROVENANCE.md.
      </footer>
    </div>
  );
}
