import { redirect } from 'next/navigation';

export default function CropHealthRedirect() {
  redirect('/dashboard/farmer/soil-health');
}
