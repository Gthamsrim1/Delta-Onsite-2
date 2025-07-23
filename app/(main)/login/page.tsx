'use client'
import React, { useEffect, useRef, useState } from 'react'
import { User, Lock, Mail, LockKeyhole, Eye, EyeOff } from 'lucide-react'
import gsap from 'gsap'
import axios from 'axios'
import { useRouter } from 'next/navigation'

const page = () => {
  const router = useRouter();
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const signupRef = useRef<HTMLDivElement>(null)
  const loginRef = useRef<HTMLDivElement>(null)


  
  useEffect(() => {
    gsap.to(panelRef.current, {
      rotate: showSignUp ? 30 : -30,
      duration: 1,
      ease: 'power2.inOut',
    })
    gsap.to(loginRef.current, {
      opacity: showSignUp ? 0 : 100,
      duration: 0.7,
      ease: 'power2.inOut',
    })
    gsap.to(signupRef.current, {
      opacity: showSignUp ? 100 : 0,
      duration: 0.7,
      ease: 'power2.inOut',
    })
    gsap.to(signupRef.current, {
      opacity: showSignUp ? 100 : 0,
      duration: 0.7,
      ease: 'power2.inOut',
    })
  }, [showSignUp])

  const handleLogin = () => {
    if (!showSignUp) {
      axios.post('http://localhost:3000/api/users', { email: username, password: password, type: "login" })
        .then(result => {
          const data = result.data
          if (data) {
            if (data.message == "User doesn't exist") {
              alert(data.message)
              return;
            }
            if (data.message == "Incorrect password") {
              alert(data.message);
              return;
            }
            const user = data.user
            const id = data.id
            const email = data.email
            localStorage.setItem("curUser", JSON.stringify({ user, id, email }));
            window.dispatchEvent(new Event("curUserChanged"));
            router.push(`/`)
          }
        })
        .catch(err => console.log(err))
    } else {
      if (password !== confirmPassword) {
        alert("Passwords do not match!")
        return
      }

      axios.post('http://localhost:3000/api/users', { email, user: username, password, type: "signup" })
        .then(result => {
          const data = result.data;
          if (data.message == "User already exists") {
            alert("User Already exists");
            return;
          }
          console.log(result)
          setShowSignUp(false)
        })
        .catch(err => console.log(err))
    }
  }

  return (
    <div className='w-screen h-screen bg-[url(/login-back.jpg)] flex items-center justify-center'>
      <div className='w-[80vw] h-[70vh] bg-radial from-black/10 to-black/40 rounded-lg overflow-hidden shadow-lg border border-white/60 flex'>
        <div className={`w-[30%] p-10 text-white flex flex-col absolute left-[15vw] justify-center top-[35vh] scale-150 items-center transition-all ${showSignUp ? "opacity-100 pointer-events-auto delay-700" : "opacity-0 pointer-events-none translate-y-10"}`}>
          <h2 className='text-white text-5xl font-semibold text-shadow-[0px_0px_16px_rgb(255,255,255)] animate-pulse'>Join Us!</h2>
          <p className="text-white/90 text-xl font-medium leading-relaxed drop-shadow-lg">
            Sign up now to start your 
            <span className="text-emerald-400 font-semibold"> journey</span>
            !
          </p>
        </div>
        <div ref={loginRef} className='w-1/2 p-10 text-white flex flex-col justify-center'>
          <h2 className='text-3xl font-bold mb-8'>Login</h2>

          <div className='mb-4 flex items-center border-b border-gray-400'>
            <User className='mr-3 text-gray-400 w-5 h-5' />
            <input
              type='text'
              placeholder='Username'
              className='bg-transparent outline-none text-white w-full py-2'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className='mb-6 flex items-center border-b border-gray-400'>
            <Lock className='mr-3 text-gray-400 w-5 h-5' />
            <input
              type={`${showPassword ? "text" : "password"}`}
              placeholder='Password'
              className='bg-transparent outline-none text-white w-full py-2'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!showPassword ? <Eye onClick={() => setShowPassword(true)} className='mr-3 text-gray-400 w-5 h-5 cursor-pointer' /> : <EyeOff onClick={() => setShowPassword(false)} className='mr-3 text-gray-400 w-5 h-5 cursor-pointer' />}
          </div>

          <button
            onClick={handleLogin}
            className='bg-gradient-to-r cursor-pointer from-cyan-500 to-cyan-400 text-white font-semibold py-2 rounded-full shadow-md hover:opacity-90 transition-all'
          >
            Login
          </button>

          <p className='mt-4 text-sm'>
            Don’t have an account?{' '}
            <span onClick={() => setShowSignUp(true)} className='text-cyan-400 cursor-pointer hover:underline'>
              Sign Up
            </span>
          </p>
        </div>

        <div ref={panelRef} className='relative right-[-15vh] top-[-42vh] w-[130vh] h-[160vh] bg-radial pointer-events-none from-cyan-200/40 to-cyan-400/60S backdrop-saturate-200 text-black text-center px-6 flex flex-col justify-center items-center rounded-lg origin-left z-0' />
      
        <div ref={signupRef} className='w-[30%] p-10 text-white flex flex-col absolute right-[10vw] justify-center'>
          <h2 className='text-3xl font-bold mb-8'>Sign Up</h2>

          <div className='mb-4 flex items-center border-b border-white'>
            <User className='mr-3 text-white w-5 h-5' />
            <input
              type='text'
              placeholder='Username'
              className='bg-transparent outline-none text-white w-full py-2'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className='mb-4 flex items-center border-b border-white'>
            <Mail className='mr-3 text-white w-5 h-5' />
            <input
              type='email'
              placeholder='Enter Your Email'
              className='bg-transparent outline-none text-white w-full py-2'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className='mb-6 flex items-center border-b border-white'>
            <Lock className='mr-3 text-white w-5 h-5' />
            <input
              type={`${showPassword ? "text" : "password"}`}
              placeholder='Password'
              className='bg-transparent outline-none text-white w-full py-2'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!showPassword ? <Eye onClick={() => setShowPassword(true)} className='mr-3 text-white w-5 h-5 cursor-pointer' /> : <EyeOff onClick={() => setShowPassword(false)} className='mr-3 text-white w-5 h-5 cursor-pointer' />}
          </div>
          <div className='mb-6 flex items-center border-b border-white'>
            <LockKeyhole className='mr-3 text-white w-5 h-5' />
            <input
              type={`${showPassword ? "text" : "password"}`}
              placeholder='Confirm Password'
              className='bg-transparent outline-none text-white w-full py-2'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            className='bg-gradient-to-r from-cyan-500 cursor-pointer to-cyan-400 text-white font-semibold py-2 rounded-full shadow-md hover:opacity-90 transition-all'
          >
            Register
          </button>

          <p className='mt-4 text-sm'>
            Already have an account?{' '}
            <span onClick={() => {setShowSignUp(false)
                                  setShowPassword(false)
            }} className='text-cyan-400 cursor-pointer hover:underline'>
              Login
            </span>
          </p>
          
        </div>
        <div className={`w-[30%] p-10 text-white flex flex-col absolute right-[15vw] justify-center top-[35vh] scale-150 items-center transition-all ${showSignUp ? "opacity-0 pointer-events-none translate-y-10" : "opacity-100 pointer-events-auto delay-700"}`}>
          <h2 className='text-white text-5xl font-semibold text-shadow-[0px_0px_16px_rgb(255,255,255)] animate-pulse'>Welcome Back!</h2>
          <p className="text-white/90 text-xl font-medium leading-relaxed drop-shadow-lg">
          Login to get back into 
          <span className="text-emerald-400 font-semibold"> booking</span>
          !
          </p>
        </div>
      </div>
    </div>
  )
}

export default page
