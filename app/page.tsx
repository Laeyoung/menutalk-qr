import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">메뉴톡 QR</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">메뉴판 사진 한 장이면, 외국인 손님이 자기 말로 주문합니다.</h1>
        <p className="mt-4 text-muted">
          한국어 메뉴판을 찍어 올리면 5개 언어 음성 메뉴와 QR이 생깁니다. 손님 요청은 사장님이 확인한 알레르기 정보와 대조된 뒤, 직원이 바로 읽는 큰 한국어 주문 카드로 바뀝니다.
        </p>
      </div>
      <Link href="/new" className="rounded-2xl bg-brand px-6 py-4 text-center text-lg font-bold text-brand-ink shadow-sm">
        메뉴판 등록하기
      </Link>
      <ul className="grid gap-3 text-sm text-muted">
        <li>① 사진 올리기 → AI가 메뉴·가격·추정 알레르기를 표로 만듭니다</li>
        <li>② 사장님이 고치고 알레르기를 &ldquo;확인함&rdquo;으로 체크 → 공개</li>
        <li>③ 테이블 QR → 손님은 앱 설치 없이 자기 언어로 보고, 듣고, 요청합니다</li>
      </ul>
      <Link href="/d" className="text-center text-sm underline">
        데모 메뉴 보기
      </Link>
    </main>
  );
}
