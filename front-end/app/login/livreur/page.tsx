"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Leaf, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin,
  Clock,
  ChevronDown,
  Check,
  Loader2
} from "lucide-react"

type AuthMode = "login" | "signup"
type UserRole = "client" | "parent" | "livreur"

const cities = ["Fès", "Meknès", "Casablanca", "Rabat"]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  // Par défaut, on sélectionne "livreur" car on est sur la page Livreur
  const [selectedRole, setSelectedRole] = useState<UserRole>("livreur")
  const [selectedCity, setSelectedCity] = useState("")
  const [showCityDropdown, setShowCityDropdown] = useState(false)

  // États du formulaire
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // États de chargement et d'erreur
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // On réinitialise les erreurs
    setLoading(true);

    try {
      if (mode === "signup") {
        // --- LOGIQUE D'INSCRIPTION ---
        if (password !== confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas.");
        }
        if (!acceptTerms) {
          throw new Error("Vous devez accepter les conditions (CGU).");
        }

        // Formatage du téléphone pour le backend (ajout de +212)
        let formattedPhone = phone;
        if (phone) {
          formattedPhone = phone.startsWith("0") ? `+212${phone.substring(1)}` : `+212${phone}`;
        }

        const response = await fetch("http://localhost:8000/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            phone: formattedPhone || undefined, // On envoie le tel uniquement s'il est rempli
            password: password,
            role: selectedRole.toUpperCase() // Envoie CLIENT, PARENT ou LIVREUR
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || "Erreur lors de la création du compte.");
        }

        // Si c'est un succès
        setMode("login");
        alert("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
        setPassword(""); 
        setConfirmPassword("");

      } else {
        // --- LOGIQUE DE CONNEXION ---
        const response = await fetch("http://localhost:8000/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login_id: email, // Ton backend gère l'email ou le téléphone ici
            password: password,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || "Email ou mot de passe incorrect.");
        }

        const data = await response.json();
        
        // On sauvegarde le token JWT
        localStorage.setItem("token", data.access_token);
        
        // Redirection vers le tableau de bord livreur
        router.push("/dashboard"); 
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#F07C00] to-[#F5C400] p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating delivery decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 text-8xl rotate-12 animate-bounce" style={{ animationDuration: '3s' }}>🛵</div>
          <div className="absolute top-40 right-32 text-7xl -rotate-12 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>📦</div>
          <div className="absolute bottom-40 left-32 text-6xl rotate-45 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>🗺️</div>
          <div className="absolute bottom-20 right-20 text-8xl -rotate-6 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1.5s' }}>🏍️</div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="text-3xl font-bold text-white">SOUKI</span>
              <span className="text-lg text-white/80 ml-2">Espace Livreur</span>
            </div>
          </Link>
        </div>

        {/* Central content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight text-balance">
            Livrez la fraîcheur au quotidien.
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-md">
            Gérez vos itinéraires, suivez vos courses et rejoignez la flotte régionale.
          </p>
          
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 max-w-sm">
            <div className="p-2 bg-white/20 rounded-xl">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">Secteurs optimisés</p>
              <p className="text-white/70 text-sm">Fès et sa région</p>
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="relative z-10 text-white/60 text-sm">
          © 2026 SOUKI Fresh Market
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-12 bg-white">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <span className="text-xl font-bold text-[#F07C00]">SOUKI Fresh Market</span>
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                mode === "login" ? "text-[#F07C00]" : "text-[#8A8A8A] hover:text-[#3D3D3D]"
              }`}
            >
              Se connecter
              {mode === "login" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F07C00]" />
              )}
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                mode === "signup" ? "text-[#F07C00]" : "text-[#8A8A8A] hover:text-[#3D3D3D]"
              }`}
            >
              S'inscrire
              {mode === "signup" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F07C00]" />
              )}
            </button>
          </div>

          {/* Affichage des Erreurs */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Email ou Téléphone
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <input
                    type="text"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      rememberMe ? "bg-[#F07C00] border-[#F07C00]" : "border-gray-300"
                    }`}
                  >
                    {rememberMe && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-[#3D3D3D]">Se souvenir de moi</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-[#1A4F8A] hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 bg-[#F07C00] text-white rounded-xl font-semibold text-lg hover:bg-[#D66B00] transition-colors shadow-lg shadow-[#F07C00]/30 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Se connecter"}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-[#8A8A8A]">ou continuer avec</span>
                </div>
              </div>

              <button
                type="button"
                className="w-full py-3 border-2 border-gray-200 rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-[#3D3D3D]">Continuer avec Google</span>
              </button>
            </form>
          )}

          {/* Signup Form */}
          {mode === "signup" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                    Prénom
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    placeholder="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Téléphone
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 px-3 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-[#3D3D3D]">
                    <span className="text-lg">🇲🇦</span>
                    <span>+212</span>
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                    <input
                      type="tel"
                      placeholder="6XX-XXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Ville
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <button
                    type="button"
                    onClick={() => setShowCityDropdown(!showCityDropdown)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors text-left flex items-center justify-between"
                  >
                    <span className={selectedCity ? "text-[#3D3D3D]" : "text-[#8A8A8A]"}>
                      {selectedCity || "Sélectionnez votre ville"}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-[#8A8A8A] transition-transform ${showCityDropdown ? "rotate-180" : ""}`} />
                  </button>
                  {showCityDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                      {cities.map(city => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city)
                            setShowCityDropdown(false)
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-[#FFF5EB] transition-colors ${
                            selectedCity === city ? "bg-[#FFF5EB] text-[#F07C00]" : "text-[#3D3D3D]"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-[#F07C00] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Type de compte
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "client", label: "Client" },
                    { value: "parent", label: "Parent" },
                    { value: "livreur", label: "Livreur" },
                  ].map(role => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value as UserRole)}
                      className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
                        selectedRole === role.value
                          ? "bg-[#F07C00] text-white"
                          : "bg-gray-100 text-[#3D3D3D] hover:bg-gray-200"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div
                  onClick={() => setAcceptTerms(!acceptTerms)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mt-0.5 ${
                    acceptTerms ? "bg-[#F07C00] border-[#F07C00]" : "border-gray-300"
                  }`}
                >
                  {acceptTerms && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#3D3D3D]">
                  J'accepte les{" "}
                  <Link href="/cgu" className="text-[#1A4F8A] hover:underline">
                    CGU
                  </Link>{" "}
                  et la{" "}
                  <Link href="/privacy" className="text-[#1A4F8A] hover:underline">
                    Politique de Confidentialité
                  </Link>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 bg-[#F07C00] text-white rounded-xl font-semibold text-lg hover:bg-[#D66B00] transition-colors shadow-lg shadow-[#F07C00]/30 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Créer mon compte"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}