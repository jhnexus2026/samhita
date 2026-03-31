"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Database, 
  Activity, 
  MessageSquare, 
  Mic, 
  ChevronRight,
  TrendingUp,
  Globe,
  FileText,
  ScanSearch,
  Cpu
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/40 via-violet-50/60 to-purple-50/50 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 text-slate-900 dark:text-white selection:bg-indigo-500/30 selection:text-white overflow-x-hidden transition-colors duration-300 relative">
      {/* ── Decorative Background Shapes (outlines only, behind content) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Large hexagon outline — top left */}
        <svg className="absolute -top-20 -left-32 w-[420px] h-[420px] text-indigo-400/[0.12] dark:text-indigo-400/[0.15]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 18s ease-in-out infinite" }}>
          <polygon points="100,10 180,50 180,120 100,160 20,120 20,50" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Triangle outline — top right */}
        <svg className="absolute top-32 right-12 w-[260px] h-[260px] text-violet-400/[0.10] dark:text-violet-400/[0.14]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 22s ease-in-out infinite" }}>
          <polygon points="100,15 190,175 10,175" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Circle outline — mid left */}
        <svg className="absolute top-[40%] -left-16 w-[320px] h-[320px] text-fuchsia-400/[0.08] dark:text-fuchsia-400/[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 25s ease-in-out infinite" }}>
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Diamond outline — right side mid */}
        <svg className="absolute top-[55%] right-[5%] w-[200px] h-[200px] text-indigo-400/[0.10] dark:text-indigo-400/[0.15]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 20s ease-in-out infinite" }}>
          <polygon points="100,10 190,100 100,190 10,100" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Pentagon outline — bottom left */}
        <svg className="absolute bottom-[15%] left-[8%] w-[280px] h-[280px] text-violet-400/[0.08] dark:text-violet-400/[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 16s ease-in-out infinite" }}>
          <polygon points="100,10 190,75 155,175 45,175 10,75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Ring — bottom right */}
        <svg className="absolute -bottom-10 right-[15%] w-[350px] h-[350px] text-indigo-500/[0.08] dark:text-indigo-500/[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 28s ease-in-out infinite" }}>
          <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Small triangle outline — center-ish */}
        <svg className="absolute top-[70%] left-[40%] w-[120px] h-[120px] text-fuchsia-400/[0.10] dark:text-fuchsia-400/[0.14]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 14s ease-in-out infinite" }}>
          <polygon points="100,20 180,170 20,170" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Octagon outline — top center */}
        <svg className="absolute top-[10%] left-[45%] w-[180px] h-[180px] text-violet-400/[0.08] dark:text-violet-400/[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 24s ease-in-out infinite" }}>
          <polygon points="70,10 130,10 180,55 180,130 130,180 70,180 20,130 20,55" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">SAMHITA</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[13px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">
            <Link href="/platform" className="hover:text-slate-900 dark:hover:text-white transition-colors">Platform</Link>
            <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition-colors">Dashboard</Link>
            <Link href="/documents" className="hover:text-slate-900 dark:hover:text-white transition-colors">Records</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 dark:hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-white/5">
                Launch Intelligence
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-40 pb-32 overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-indigo-500/5 dark:bg-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none -z-10 animate-pulse" style={{ transform: "translate(-50%, -50%)" }} />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <motion.div 
            className="lg:col-span-12 xl:col-span-7 relative"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <div className="relative z-10 space-y-8 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl rounded-3xl p-10 border border-slate-200/60 dark:border-white/5 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Next-Gen Clinical Intelligence</span>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9]">
              Clinical data <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 dark:from-indigo-400 via-violet-500 dark:via-violet-400 to-fuchsia-500 dark:to-fuchsia-400">
                decoded.
              </span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-xl text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Samhita transforms chaotic medical records into high-fidelity, interoperable data. 
              Automatically map to ICD-10, LOINC, and CPT with superhuman accuracy.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Link href="/upload">
                <button className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-2xl shadow-indigo-600/20 group">
                  Start Processing Documents
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/platform">
                <button className="w-full sm:w-auto px-8 py-4 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold border border-slate-200 dark:border-white/5 transition-all">
                  View Architecture
                </button>
              </Link>
            </motion.div>
            </div>
          </motion.div>

          {/* Dynamic CSS Visual */}
          <motion.div 
            className="lg:col-span-12 xl:col-span-5 relative h-[500px] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Spinning Rings */}
              <motion.div 
                className="absolute w-80 h-80 border border-indigo-500/20 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div 
                className="absolute w-64 h-64 border border-violet-500/20 rounded-full"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Floating Data Nodes */}
              <motion.div 
                className="absolute p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 rounded-2xl shadow-2xl z-20"
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Database className="h-8 w-8 text-indigo-500" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full animate-ping" />
              </motion.div>

              <motion.div 
                className="absolute top-10 right-10 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-violet-200 dark:border-violet-500/30 rounded-2xl shadow-2xl z-10"
                animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Cpu className="h-6 w-6 text-violet-500" />
              </motion.div>

              <motion.div 
                className="absolute bottom-10 left-10 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-200 dark:border-emerald-500/30 rounded-2xl shadow-2xl z-10"
                animate={{ y: [0, -15, 0], x: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              >
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </motion.div>

              {/* The "Brain" Core */}
              <div className="relative h-48 w-48 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)]">
                <Activity className="h-20 w-20 text-white animate-pulse" />
                <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse" />
              </div>

              {/* Connecting Lines */}
              <div className="absolute h-px w-32 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent rotate-45 top-1/2 left-1/2 -translate-x-full -translate-y-full opacity-20" />
              <div className="absolute h-px w-32 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent -rotate-45 top-1/2 left-1/2 -translate-y-full opacity-20" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FHIR Conversion Section */}
      <section className="relative z-10 py-24 border-y border-slate-200/50 dark:border-white/5 bg-slate-100/60 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">
                Instant <span className="text-indigo-500 italic">FHIR R4</span> Conversion
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed mb-8">
                Break the walls of data silos. Samhita automatically structures messy clinical notes 
                into production-ready FHIR resources, ensuring full interoperability with 
                modern EHR systems.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ABDM & PMJAY Compliant Output</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Automated ICD-10 & LOINC Mapping</span>
                </div>
              </div>
            </div>

            <div className="relative group p-1 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-[2rem]">
               <div className="bg-slate-50 dark:bg-slate-900 rounded-[1.9rem] flex flex-col md:flex-row h-full overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl shadow-indigo-500/5 dark:shadow-black/20 transition-colors duration-300">
                 {/* Left: Input */}
                 <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 bg-slate-100/80 dark:bg-slate-900/50">
                   <div className="flex items-center gap-2 mb-4">
                     <FileText className="h-4 w-4 text-indigo-400" />
                     <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unstructured Note</span>
                   </div>
                   <div className="font-mono text-[11px] text-slate-300 dark:text-slate-400 space-y-2">
                      <p className="p-2 rounded bg-slate-800 dark:bg-slate-950 border border-slate-700 dark:border-white/5 text-slate-300 dark:text-slate-400">
                        Pt c/o severe <span className="text-red-400">abdominal pain</span>. 
                        Suspected <span className="text-indigo-400">Appendicitis</span>.
                      </p>
                      <p className="p-2 rounded bg-slate-800/80 dark:bg-slate-950/50 border border-slate-700 dark:border-white/5 text-slate-300 dark:text-slate-400">
                        Vitals: <span className="text-amber-400">HR 110, BP 140/90</span>.
                      </p>
                   </div>
                 </div>
                 {/* Right: Output */}
                 <div className="flex-1 p-6 bg-slate-900 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                       <ScanSearch className="h-4 w-4 text-emerald-400" />
                       <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Resource Asset</span>
                    </div>
                    <pre className="font-mono text-[10px] text-emerald-400/90 dark:text-emerald-400/80 leading-tight relative z-10">
{`{
  "resourceType": "Condition",
  "name": "Appendicitis",
  "code": "K37",
  "conf": 0.992
},
{
  "resourceType": "Observation",
  "code": "8480-6",
  "val": 140
}`}
                    </pre>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="relative z-10 py-24 bg-white/60 dark:bg-slate-900/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Zap}
              title="Hyper-Fast Extraction"
              desc="Transform handwritten prescriptions and complex PDFs into structured data in under 5 seconds."
            />
            <FeatureCard 
              icon={Database}
              title="FHIR R4 Compliant"
              desc="Every resource is automatically formatted to global standards for seamless EHR integration."
            />
            <FeatureCard 
              icon={TrendingUp}
              title="Revenue Discovery"
              desc="Identify billing leakages and missed codes automatically with clinical-grade audit trails."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-20 border-t border-slate-200/50 dark:border-white/5 text-center transition-colors duration-300 overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, #ede9fe, #c7d2fe, #f3e8ff, #ddd6fe, #e0e7ff, #ede9fe)",
            backgroundSize: "600% 600%",
            animation: "footerGlow 16s ease-in-out infinite",
          }}
        />
        {/* Dark mode overlay — covers the light gradient, shows a subtle dark animated version */}
        <div
          className="absolute inset-0 -z-10 opacity-0 dark:opacity-100 transition-opacity duration-300"
          style={{
            background: "linear-gradient(135deg, #020617, #1e1b4b, #0c0a1f, #172554, #020617, #1e1b4b)",
            backgroundSize: "600% 600%",
            animation: "footerGlow 24s ease-in-out infinite",
          }}
        />

        {/* Floating decorative elements */}
        <div className="absolute inset-0 -z-[5] pointer-events-none overflow-hidden">
          {/* Glowing orb — left */}
          <div
            className="absolute w-40 h-40 rounded-full bg-indigo-400/15 dark:bg-indigo-500/10 blur-2xl"
            style={{ left: "10%", top: "20%", animation: "shapeFloat 12s ease-in-out infinite" }}
          />
          {/* Glowing orb — right */}
          <div
            className="absolute w-32 h-32 rounded-full bg-violet-400/15 dark:bg-violet-500/8 blur-2xl"
            style={{ right: "12%", top: "30%", animation: "shapeFloat2 14s ease-in-out infinite" }}
          />
          {/* Pulsing ring — center top */}
          <svg className="absolute w-24 h-24 text-indigo-400/20 dark:text-indigo-400/10" style={{ left: "50%", top: "10%", transform: "translateX(-50%)", animation: "shapeFloat 10s ease-in-out infinite" }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" className="animate-pulse" />
          </svg>
          {/* Small floating dots */}
          <div className="absolute w-2 h-2 rounded-full bg-indigo-500/25 dark:bg-indigo-400/15" style={{ left: "25%", top: "60%", animation: "shapeFloat2 8s ease-in-out infinite" }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-violet-500/25 dark:bg-violet-400/15" style={{ left: "70%", top: "25%", animation: "shapeFloat 9s ease-in-out infinite" }} />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-purple-500/20 dark:bg-purple-400/10" style={{ left: "80%", top: "70%", animation: "shapeFloat2 11s ease-in-out infinite" }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400/30 dark:bg-indigo-400/15" style={{ left: "40%", top: "75%", animation: "shapeFloat 7s ease-in-out infinite" }} />
          <div className="absolute w-2 h-2 rounded-full bg-fuchsia-400/20 dark:bg-fuchsia-400/10" style={{ left: "15%", top: "80%", animation: "shapeFloat2 13s ease-in-out infinite" }} />
          {/* Rotating diamond */}
          <svg className="absolute w-10 h-10 text-violet-400/20 dark:text-violet-400/10" style={{ right: "30%", top: "50%", animation: "shapeFloat 15s ease-in-out infinite" }} viewBox="0 0 100 100">
            <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          {/* Small hexagon */}
          <svg className="absolute w-8 h-8 text-indigo-400/15 dark:text-indigo-400/8" style={{ left: "35%", top: "15%", animation: "shapeFloat2 16s ease-in-out infinite" }} viewBox="0 0 100 100">
            <polygon points="50,5 90,25 90,65 50,85 10,65 10,25" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-4xl font-black mb-10">Experience Clinical AI.</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/dashboard">
              <button className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold transition-all hover:scale-105">
                Go to Dashboard
              </button>
            </Link>
          </div>
          <p className="mt-12 text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.5em]">&copy; Samhita Intelligence v1.0</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-8 rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950 hover:border-indigo-400 dark:hover:border-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 group">
      <div className="h-12 w-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6 text-indigo-500" />
      </div>
      <h4 className="text-xl font-bold mb-3">{title}</h4>
      <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
        {desc}
      </p>
    </div>
  );
}
