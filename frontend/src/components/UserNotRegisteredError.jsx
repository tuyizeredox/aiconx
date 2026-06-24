import React from 'react';
import { motion } from 'framer-motion';
import Logo from "@/components/layout/Logo";
import { AlertTriangle, Home, Mail } from 'lucide-react';
import { Button } from "@/components/ui/button";

const UserNotRegisteredError = () => {
  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#0a0a0c] selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)]" />
        
        {/* Animated Mesh Gradients */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 80, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-orange-600/10 rounded-full blur-[120px]"
        />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="max-w-md w-full relative z-10 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/[0.02] backdrop-blur-3xl p-8 sm:p-12 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 relative overflow-hidden group text-center"
        >
          <div className="space-y-8">
            <div className="text-center space-y-6">
              <Logo 
                size="lg" 
                className="flex-col !gap-6 mx-auto" 
                subtext="Access Control" 
                showDecoration={true} 
              />
            </div>

            <div className="space-y-6">
              <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20">
                <AlertTriangle className="w-10 h-10 text-orange-500" />
              </div>
              
              <div className="space-y-3">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Access Restricted</h1>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Identity not found in our records. This workspace is reserved for registered members of the Aicon X network.
                </p>
              </div>

              <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 text-left space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recommended Actions:</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    Verify your credentials
                  </li>
                  <li className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    Contact workspace admin
                  </li>
                  <li className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    Try re-initializing identity
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="group w-full bg-orange-600 text-white py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-500 flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-orange-500/60 border-t border-white/20"
                >
                  <Home className="w-4 h-4 mr-2" /> Return to Hub
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = 'mailto:admin@iqon.network'}
                  className="w-full h-16 rounded-2xl font-black text-[10px] uppercase tracking-widest border-white/5 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-[0.98]"
                >
                  <Mail className="w-4 h-4 mr-2" /> Request Access
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
