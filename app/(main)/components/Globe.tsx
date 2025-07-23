'use client'
import React, { forwardRef, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh } from 'three'

interface GlobeProps {
  [key: string]: any
}

export const Globe = forwardRef<Mesh, GlobeProps>((props, ref) => {
  const { nodes, materials } = useGLTF('./models/Globe.glb') as any

  const hasMoved = useRef(false)

  useFrame((_, delta) => {
    const meshRef = ref as React.MutableRefObject<Mesh>
    if (meshRef.current && !hasMoved.current) {
      meshRef.current.position.set(1.5, -0.7, -0.5)
      hasMoved.current = true
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += 0.03 * delta
      meshRef.current.rotation.x -= 0.01 * delta
    }
  })

  return (
    <group {...props} dispose={null}>
      <mesh
        ref={ref}
        geometry={nodes.Mesh_0.geometry}
        material={materials.Material_0}
      />
    </group>
  )
})

useGLTF.preload('./models/Globe.glb')
