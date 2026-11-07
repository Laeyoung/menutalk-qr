import type { Metadata } from 'next';
import { UploadForm } from './upload-form';

export const metadata: Metadata = { title: '메뉴판 등록 — 메뉴톡 QR' };

export default function NewPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">메뉴판 등록</h1>
      <p className="mt-1 text-sm text-muted">회원가입 없이 사진 한 장으로 시작합니다. 관리 링크는 이 기기에 저장됩니다.</p>
      <UploadForm />
    </main>
  );
}
