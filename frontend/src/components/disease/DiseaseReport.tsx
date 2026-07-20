'use client';

import { Suspense, lazy } from 'react';
import { ScanResult } from './types';
import { useAuth } from '@/context/AuthContext';
import { buildDiseaseReportData } from '@/components/ReportGenerator';

const ReportGenerator = lazy(() => import('@/components/ReportGenerator'));

interface Props {
  result: ScanResult;
  uploadedPreview: string | null;
  onClose: () => void;
}

export default function DiseaseReport({ result, uploadedPreview, onClose }: Props) {
  const { user } = useAuth();
  const reportData = buildDiseaseReportData(result, user?.name);

  return (
    <Suspense fallback={null}>
      <ReportGenerator
        data={{ ...reportData, imagePreview: uploadedPreview }}
        onClose={onClose}
      />
    </Suspense>
  );
}
