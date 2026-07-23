"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"
import { isValidMoroccanPhone, normalizeMoroccanPhone, PHONE_ERROR_MSG } from "@/lib/phoneValidator"
import { GoogleLoginButton } from "@/components/auth/google-login-button"
import { PasswordStrength } from "@/components/souki/password-strength"
import { PolicyLink } from "@/components/souki/policy-link"
import { toast } from "sonner"
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin,
  ChevronDown,
  Check,
  Loader2,
  Users, 
  AlertCircle 
} from "lucide-react"

type AuthMode = "login" | "signup"
type UserRole = "client" | "parent" | "livreur"

const cities = ["Fès", "Meknès", "Casablanca", "Rabat"]
function ParentLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login: contextLogin, googleLogin } = useAuth()
  const redirectTarget = searchParams.get("redirect") || "/"
  const [mode, setMode] = useState<AuthMode>("login")
  
  // UI States
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  
  // Form States
  const [selectedRole, setSelectedRole] = useState<UserRole>("parent")
  const [selectedCity, setSelectedCity] = useState("")
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginId, setLoginId] = useState(""); // Sert d'email pour l'inscription, et d'identifiant (email/tel) pour le login
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Loading & Error States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  // Nettoyer l'erreur d'un champ
  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Validation en temps réel pendant la frappe (Live Validation)
  const handleFieldChange = (field: string, value: string) => {
    if (field === "firstName") setFirstName(value);
    if (field === "lastName") setLastName(value);
    if (field === "loginId") setLoginId(value);
    if (field === "phone") setPhone(value);
    if (field === "password") setPassword(value);
    if (field === "confirmPassword") setConfirmPassword(value);

    if (mode === "signup") {
      let currentError = "";

      if (field === "phone") {
        if (value && !isValidMoroccanPhone(value)) {
          currentError = PHONE_ERROR_MSG;
        }
      }

      if (field === "password") {
        if (value.length > 0 && value.length < 8) currentError = "8 caractères minimum requis.";
        else if (value.length > 0 && !/[A-Z]/.test(value)) currentError = "Doit contenir une lettre majuscule.";
        else if (value.length > 0 && !/[0-9]/.test(value)) currentError = "Doit contenir au moins un chiffre.";
        
        if (confirmPassword && value !== confirmPassword) {
          setFieldErrors(prev => ({ ...prev, confirmPassword: "Les mots de passe ne correspondent pas." }));
        } else if (confirmPassword && value === confirmPassword) {
          setFieldErrors(prev => { const n = {...prev}; delete n.confirmPassword; return n; });
        }
      }

      if (field === "confirmPassword") {
        if (value && value !== password) {
          currentError = "Les mots de passe ne correspondent pas.";
        }
      }

      setFieldErrors(prev => {
        if (!currentError) {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        }
        return { ...prev, [field]: currentError };
      });
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (mode === "signup") {
      if (!firstName.trim()) errors.firstName = "Le prénom est requis.";
      if (!lastName.trim()) errors.lastName = "Le nom est requis.";
      if (!loginId.trim()) errors.loginId = "L'adresse email est requise.";
      else if (!/\S+@\S+\.\S+/.test(loginId)) errors.loginId = "Format d'email invalide.";
      
      if (!selectedCity) errors.selectedCity = "Veuillez sélectionner une ville.";
      
      if (!password) errors.password = "Le mot de passe est requis.";
      else if (password.length < 8) errors.password = "Le mot de passe doit faire au moins 8 caractères.";
      
      if (password !== confirmPassword) errors.confirmPassword = "Les mots de passe ne correspondent pas.";
      if (!acceptTerms) errors.acceptTerms = "Vous devez accepter la politique de confidentialité.";
    } else {
      if (!loginId.trim()) errors.loginId = "L'email ou le téléphone est requis.";
      if (!password) errors.password = "Le mot de passe est requis.";
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(""); 
    
    if (Object.keys(fieldErrors).length > 0) return;

    // ── Strict email format validation (prevents malformed input & injection) ──
    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    const trimmedId = loginId.trim()
    if (trimmedId.includes("@") && !EMAIL_REGEX.test(trimmedId)) {
      setGeneralError("Format d'email invalide. Veuillez saisir une adresse email correcte.")
      return
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const formattedPhone = phone.trim() ? normalizeMoroccanPhone(phone) : "";

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loginId,
            phone: formattedPhone || undefined,
            password: password,
            role: selectedRole.toUpperCase()
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Gestion des erreurs de validation de Pydantic (FastAPI)
          if (response.status === 422 && Array.isArray(data.detail)) {
            const apiErrors: Record<string, string> = {};
            data.detail.forEach((err: any) => {
              const field = err.loc[err.loc.length - 1]; // Extrait le nom du champ (ex: 'phone')
              apiErrors[field] = err.msg;
            });
            setFieldErrors(apiErrors);
            setLoading(false);
            return;
          }
          // Gestion des erreurs métier (ex: email déjà pris)
          throw new Error(data.detail || "Erreur lors de la création du compte.");
        }

        router.push(
          `/verify?userId=${data.id}&channel=${data.verification_channel}&target=${encodeURIComponent(data.verification_target || "")}&role=${String(data.role || selectedRole).toLowerCase()}`
        );
        toast.success("Compte parent cree avec succes. Vous pouvez maintenant vous connecter.")
        setPassword(""); 
        return;

      } else {
        // Mode Login
        const nextUser = await contextLogin(loginId, password, "PARENT");
        setTimeout(() => {
          router.push(redirectTarget !== "/" ? redirectTarget : nextUser.default_dashboard || "/parent");
        }, 300);
      }
    } catch (err: any) {
      setGeneralError(
        err instanceof TypeError
          ? `Impossible de joindre l'API (${API_BASE_URL}). Verifiez que le back-end est demarre et accessible depuis le front.`
          : err.message || "Une erreur inattendue est survenue."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setGeneralError("")
    const nextUser = await googleLogin(credential, "PARENT")
    router.push(redirectTarget !== "/" ? redirectTarget : nextUser.default_dashboard || "/parent")
  }

  const ErrorMessage = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <span className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium animate-in fade-in slide-in-from-top-1">
        <AlertCircle className="w-3.5 h-3.5" />
        {message}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#F5C400] to-[#EAB308] p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating decorations */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 text-8xl rotate-12 animate-bounce" style={{ animationDuration: '3s' }}>👨‍👩‍👧‍👦</div>
          <div className="absolute top-40 right-32 text-7xl -rotate-12 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>🍎</div>
          <div className="absolute bottom-40 left-32 text-6xl rotate-45 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>🥪</div>
          <div className="absolute bottom-20 right-20 text-8xl -rotate-6 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1.5s' }}>🥦</div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="text-3xl font-bold text-white">SOUKI</span>
              <span className="text-lg text-white/90 ml-2 font-medium">Espace Parent</span>
            </div>
          </Link>
        </div>

        {/* Central content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight text-balance shadow-sm">
            Prenez soin de votre famille.
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-md font-medium">
            Planifiez des repas sains et commandez des produits frais pour le bien-être de vos proches.
          </p>
          
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md rounded-2xl p-4 max-w-sm border border-white/30">
            <div className="p-2 bg-white/30 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">Gestion simplifiée</p>
              <p className="text-white/80 text-sm">Pour toute la famille</p>
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="relative z-10 text-white/80 text-sm font-medium">
          © 2026 SOUKI Fresh Market
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-12 bg-white overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none border border-gray-100">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <span className="text-xl font-bold text-[#D97706]">SOUKI Espace Parent</span>
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => { setMode("login"); setGeneralError(""); setFieldErrors({}); }}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                mode === "login" ? "text-[#D97706]" : "text-[#8A8A8A] hover:text-[#3D3D3D]"
              }`}
            >
              Se connecter
              {mode === "login" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5C400]" />
              )}
            </button>
            <button
              onClick={() => { setMode("signup"); setGeneralError(""); setFieldErrors({}); }}
              className={`pb-4 px-2 font-semibold text-lg transition-colors relative ${
                mode === "signup" ? "text-[#D97706]" : "text-[#8A8A8A] hover:text-[#3D3D3D]"
              }`}
            >
              S'inscrire
              {mode === "signup" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5C400]" />
              )}
            </button>
          </div>

          {/* Erreur générale du Backend */}
          {generalError && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{generalError}</p>
            </div>
          )}

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Email ou Téléphone
                </label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.loginId ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <input
                    type="text"
                    placeholder="votre@email.com ou 06XXXXXXXX"
                    value={loginId}
                    onChange={(e) => handleFieldChange("loginId", e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.loginId 
                        ? 'border-red-500 bg-red-50 focus:border-red-500' 
                        : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                </div>
                <ErrorMessage message={fieldErrors.loginId} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.password ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => handleFieldChange("password", e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.password 
                        ? 'border-red-500 bg-red-50 focus:border-red-500' 
                        : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <ErrorMessage message={fieldErrors.password} />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      rememberMe ? "bg-[#F5C400] border-[#F5C400]" : "border-gray-300"
                    }`}
                  >
                    {rememberMe && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-[#3D3D3D]">Se souvenir de moi</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-[#D97706] hover:underline font-medium">
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 bg-[#F5C400] text-white rounded-xl font-semibold text-lg hover:bg-[#EAB308] transition-colors shadow-lg shadow-[#F5C400]/30 disabled:opacity-70"
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

              <GoogleLoginButton
                onCredential={handleGoogleLogin}
                onError={setGeneralError}
                disabled={loading}
              />
            </form>
          )}

          {/* Signup Form */}
          {mode === "signup" && (
            <form onSubmit={handleSubmit} className="space-y-4 pb-12" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Prénom</label>
                  <div className="relative">
                    <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.firstName ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(e) => handleFieldChange("firstName", e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                        fieldErrors.firstName ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                      }`}
                    />
                  </div>
                  <ErrorMessage message={fieldErrors.firstName} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Nom</label>
                  <input
                    type="text"
                    placeholder="Nom"
                    value={lastName}
                    onChange={(e) => handleFieldChange("lastName", e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.lastName ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                  <ErrorMessage message={fieldErrors.lastName} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Email</label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.loginId ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    value={loginId}
                    onChange={(e) => handleFieldChange("loginId", e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.loginId ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                </div>
                <ErrorMessage message={fieldErrors.loginId} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Téléphone</label>
                <div className="flex gap-2">
                  <div className={`flex items-center gap-1 px-3 py-3 border-2 rounded-xl text-[#3D3D3D] ${
                    fieldErrors.phone ? "border-red-500 bg-red-50" : "border-gray-200 bg-gray-50"
                  }`}>
                    <span className="text-lg">🇲🇦</span>
                    <span className="font-medium">+212</span>
                  </div>
                  <div className="relative flex-1">
                    <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.phone ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                    <input
                      type="tel"
                      placeholder="6XX-XXXXXX"
                      value={phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                        fieldErrors.phone ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                      }`}
                    />
                  </div>
                </div>
                <ErrorMessage message={fieldErrors.phone} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label>
                <div className="relative">
                  <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.selectedCity ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <button
                    type="button"
                    onClick={() => setShowCityDropdown(!showCityDropdown)}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors text-left flex items-center justify-between bg-white ${
                      fieldErrors.selectedCity ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
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
                            setSelectedCity(city);
                            clearFieldError("selectedCity");
                            setShowCityDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-[#FFFBEB] transition-colors ${
                            selectedCity === city ? "bg-[#FFFBEB] text-[#D97706]" : "text-[#3D3D3D]"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ErrorMessage message={fieldErrors.selectedCity} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.password ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => handleFieldChange("password", e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.password ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
                <ErrorMessage message={fieldErrors.password} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.confirmPassword ? 'text-red-500' : 'text-[#8A8A8A]'}`} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                      fieldErrors.confirmPassword ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-[#F5C400]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <ErrorMessage message={fieldErrors.confirmPassword} />
              </div>

              {/* Role Selector (Mis par défaut sur Parent et avec les couleurs Espace Parent) */}
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
                      className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all border-2 ${
                        selectedRole === role.value
                          ? "bg-[#F5C400] border-[#F5C400] text-white shadow-md shadow-[#F5C400]/20"
                          : "bg-white border-gray-200 text-[#3D3D3D] hover:border-[#F5C400]/30 hover:bg-[#FFFBEB]"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-start gap-2 pt-2">
                  <div
                    onClick={() => { setAcceptTerms(!acceptTerms); clearFieldError("acceptTerms"); }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mt-0.5 ${
                      acceptTerms 
                        ? "bg-[#F5C400] border-[#F5C400]" 
                        : fieldErrors.acceptTerms 
                          ? "border-red-500 bg-red-50" 
                          : "border-gray-300"
                    }`}
                  >
                    {acceptTerms && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-[#3D3D3D]">
                    J'accepte la{" "}
                    <PolicyLink className="text-[#D97706] hover:underline" />
                  </span>
                </div>
                <ErrorMessage message={fieldErrors.acceptTerms} />
              </div>

              <button
                type="submit"
                disabled={loading || Object.keys(fieldErrors).length > 0}
                className="w-full flex items-center justify-center py-3.5 bg-[#F5C400] text-white rounded-xl font-semibold text-lg hover:bg-[#EAB308] transition-colors shadow-lg shadow-[#F5C400]/30 disabled:opacity-50 mt-4"
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

export default function ParentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#1E8A3C]" />
        </div>
      }
    >
      <ParentLoginContent />
    </Suspense>
  )
}
