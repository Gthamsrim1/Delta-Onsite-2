'use client'
import React, { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Globe } from './Globe'

const ThreeScene = () => {
  const CameraRig = () => {
    const { camera } = useThree()
    const targetRotation = useRef({ x: 0, y: 0 })

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1
        const y = (e.clientY / window.innerHeight) * 2 - 1
        targetRotation.current.x = y * 0.1
        targetRotation.current.y = x * 0.1
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    useFrame(() => {
        camera.rotation.x += (targetRotation.current.x - camera.rotation.x) * 0.03
        camera.rotation.y += (targetRotation.current.y - camera.rotation.y) * 0.03
    })

    return null
  }

  const globeRef = useRef<THREE.Mesh>(null);
  return (
    // <Canvas camera={{position: [0, 0, 1], fov: 75}}>
    //     <ambientLight intensity={1} />
    //     <directionalLight position={[5, 5, 5]} />

    //     <CameraRig />
    //     <Globe ref={globeRef} />
    // </Canvas>
    null
  )
}

export default ThreeScene