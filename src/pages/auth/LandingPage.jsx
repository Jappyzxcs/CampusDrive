import { useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Car } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Welcome"
      subtitle="Select your institutional portal to sign in."
    >
      <div className="space-y-4 mb-10 mt-6">
        {/* Student & Faculty Door */}
        <button 
          onClick={() => navigate('/login')}
          className="w-full group flex items-start text-left p-6 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-primary-500 transition-all duration-200"
        >
          <div className="bg-primary-50 text-primary-700 p-3 rounded-xl mr-5 group-hover:bg-primary-600 group-hover:text-white transition-colors">
            <GraduationCap size={28} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-1">Student & Faculty</h3>
            <p className="text-slate-500 text-sm">
              Register vehicles, renew stickers, and track applications.
            </p>
          </div>
        </button>

        {/* Staff & Administrator Door */}
        <button 
          onClick={() => navigate('/staff/login')}
          className="w-full group flex items-start text-left p-6 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-800 transition-all duration-200"
        >
          {/* CHANGED: Swapped maroon classes for slate classes */}
          <div className="bg-slate-100 text-slate-700 p-3 rounded-xl mr-5 group-hover:bg-slate-800 group-hover:text-white transition-colors">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-1">Staff & Administrator</h3>
            <p className="text-slate-500 text-sm">
              GSU, BAO, and Guard dashboard access.
            </p>
          </div>
        </button>
      </div>

      {/* Visitor Access Footer */}
      <div className="text-center pt-6 border-t border-slate-100">
        <button 
          onClick={() => navigate('/visitor/login')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-600 font-medium transition-colors"
        >
          <Car size={16} />
          Guest or Visitor? Request campus entry here
        </button>
      </div>
    </AuthLayout>
  );
}