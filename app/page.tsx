import Link from 'next/link';

// 발표 표지(SAMPLE 01) 레이아웃: 격자 배경 · 라임 헤드라인 · 모노 날짜 · 흰 라벨 칩 · 시안 그래픽
export default function Home() {
  return (
    <main className="bg-grid relative flex flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-10">
        <div className="font-display text-2xl tracking-tight">
          <span className="text-lime">MENUTALK</span>
          <span className="text-heading">.</span>
          <span className="text-pink">QR</span>
        </div>
        <div className="grid gap-4">
          <p className="font-mono text-sm text-lime">2026. 11. 07 (SAT) · OBA.RUN 2nd</p>
          <span className="w-fit rounded-xl bg-heading px-4 py-2 text-sm font-bold text-ink">말하는 메뉴판</span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            <h1 className="font-display text-[44px] leading-[1.15] text-lime sm:text-6xl">
              메뉴판 사진 한 장,
              <br />
              <span className="text-heading">손님은 자기 말로</span> 주문
            </h1>
            <p className="max-w-xl text-foreground">
              한국어 메뉴판을 찍어 올리면 외국어 5개와 한국어로 된 음성 메뉴와 QR이 생깁니다. 손님 요청은 <b className="text-pink">사장님이 확인한 알레르기 정보</b>와 대조된 뒤, 직원이 바로 읽는 큰 한국어 주문 카드로 바뀝니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/new" className="rounded-2xl bg-lime px-6 py-4 text-lg font-bold text-ink">
                메뉴판 등록하기 →
              </Link>
              <Link href="/d" className="rounded-2xl border border-line bg-card px-6 py-4 text-lg font-bold text-heading">
                데모 메뉴 보기
              </Link>
            </div>
          </div>
          <Globe />
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ['01', 'text-lime', '사진 올리기', 'AI가 메뉴·가격·추정 알레르기를 표로 만듭니다'],
            ['02', 'text-pink', '가게 확인', '사장님이 고치고 알레르기를 "확인함"으로 체크해 공개'],
            ['03', 'text-blue', 'QR 한 장', '손님은 앱 설치 없이 자기 언어로 보고, 듣고, 요청'],
          ].map(([n, c, title, body]) => (
            <li key={n} className="grid gap-2 rounded-3xl bg-card p-6">
              <span className={`font-mono text-sm font-bold ${c}`}>{n}</span>
              <span className="font-display text-xl text-heading">{title}</span>
              <span className="text-sm text-foreground">{body}</span>
            </li>
          ))}
        </ol>
        <p className="font-bold text-lime">→ 번역은 AI가, 판단은 가게 데이터가 합니다.</p>
      </div>
    </main>
  );
}

function Globe() {
  return (
    <svg viewBox="0 0 340 340" className="mx-auto hidden w-full max-w-[340px] md:block" aria-hidden>
      <g fill="none" stroke="var(--cyan)" strokeWidth="1.5">
        <circle cx="160" cy="170" r="150" />
        <ellipse cx="160" cy="170" rx="150" ry="40" />
        <ellipse cx="160" cy="170" rx="100" ry="150" />
        <ellipse cx="160" cy="170" rx="40" ry="150" />
        <line x1="10" y1="170" x2="310" y2="170" />
      </g>
      <ellipse cx="160" cy="170" rx="150" ry="70" fill="none" stroke="var(--lime)" strokeWidth="1.5" />
      <circle cx="230" cy="150" r="100" fill="none" stroke="var(--lime)" strokeWidth="4" />
      <text x="230" y="145" textAnchor="middle" fill="var(--foreground)" fontSize="15">EN · 日本語</text>
      <text x="230" y="168" textAnchor="middle" fill="var(--foreground)" fontSize="15">中文 · ES · 한국어</text>
    </svg>
  );
}
