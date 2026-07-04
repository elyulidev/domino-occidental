# Algoritmo de Posicionamiento - Juego Domino Occidental

Este documento contiene la especificación formal del algoritmo corregido para el renderizado y cálculo de coordenadas en una grilla fija de 16 columnas (`C0` a `C15`) con filas dinámicas orientadas por flujo.

---

## 1. Arquitectura del Tablero y Reglas Geométricas

- **Estructura:** Grilla fija en ancho con 16 columnas ($C_0$ a $C_{15}$). Las filas crecen dinámicamente tanto en sentido positivo ($F_1, F_2, F_3...$) como negativo ($F_{-1}, F_{-2}, F_{-3}...$).
- **Dirección Obligatoria del Flujo (Serpenteo):**
  - Las filas **pares** ($F_0, F_2, F_{-2}...$) avanzan estrictamente hacia la **DERECHA ($\rightarrow$)**.
  - Las filas **impares** ($F_1, F_3, F_{-1}, F_{-3}...$) avanzan estrictamente hacia la **IZQUIERDA ($\leftarrow$)**.
- **Celdas Libres en Dirección (`espacio`):** Cantidad de celdas disponibles desde la posición actual hasta el borde de la mesa siguiendo el sentido de la marcha actual:
  - `espacio >= 2`: Lugar suficiente para colocar una ficha estándar horizontalmente.
  - `espacio == 1`: Queda exactamente una celda libre antes de chocar con el borde físico ($C_{15}$ o $C_0$).
  - `espacio == 0`: El extremo actual ya se encuentra ubicado exactamente en la celda del borde.

---

## 2. Especificación del Algoritmo (Pseudocódigo)

```text
FUNCION colocar_ficha(A, B, extremo_elegido, tablero):
    // 1. Validaciones iniciales
    SI ficha [A|B] ya está en tablero -> RECHAZAR ("Ficha repetida")
    SI extremo_elegido.valor != A Y extremo_elegido.valor != B -> RECHAZAR ("No conecta")

    // 2. Orientación de conexión
    valor_conexion = (extremo_elegido.valor == A) ? A : B
    valor_libre = (valor_conexion == A) ? B : A

    fila_act = extremo_elegido.fila
    col_act = extremo_elegido.columna
    dir_act = fila_act.direccion // → (Derecha) o ← (Izquierda)

    // ==========================================
    // CASO DE DOBLES (A == B)
    // ==========================================
    SI A == B:
        espacio = calcular_espacio_libre(fila_act, col_act, dir_act)
        SI espacio == 0:
            // L-Corner de Doble en el borde exacto
            nueva_fila = obtener_siguiente_fila_vacia(fila_act)
            colocar_en(fila_act, col_act, valor=A)
            marcar_como_doble_flotante_vertical(nueva_fila, col_act)
            nuevo_extremo = {valor=A, fila=nueva_fila, columna=col_act, dir=opuesta(dir_act)}
        SINO:
            // Colocación normal ocupando una sola celda
            col_sig = obtener_columna_siguiente(col_act, dir_act)
            colocar_en(fila_act, col_sig, valor=A)
            marcar_como_doble_flotante_eje_vertical(fila_act, col_sig)
            nuevo_extremo = {valor=A, fila=fila_act, columna=col_sig, dir=dir_act}
        RETORNAR tablero

    // ==========================================
    // CASO DE FICHAS NORMALES (A != B)
    // ==========================================
    espacio = calcular_espacio_libre(fila_act, col_act, dir_act)

    SI espacio >= 2:
        // CASO NORMAL: Horizontal en la misma fila
        c1 = obtener_columna_siguiente(col_act, dir_act)
        c2 = obtener_columna_siguiente(c1, dir_act)

        colocar_en(fila_act, c1, valor_conexion)
        colocar_en(fila_act, c2, valor_libre)
        nuevo_extremo = {valor=valor_libre, fila=fila_act, columna=c2, dir=dir_act}

    SINO SI espacio == 1:
        // CASO CRÍTICO 1: Giro Mixto Vertical (Evita dejar celdas huérfanas)
        c_borde = obtener_columna_siguiente(col_act, dir_act) // La celda límite (C0 o C15)
        nueva_fila = obtener_siguiente_fila_vacia(fila_act)

        colocar_en(fila_act, c_borde, valor_conexion) // Rellena la última celda libre
        colocar_en(nueva_fila, c_borde, valor_libre)  // Se dobla verticalmente a la nueva fila
        nuevo_extremo = {valor=valor_libre, fila=nueva_fila, columna=c_borde, dir=nueva_fila.direccion}

    SINO SI espacio == 0:
        // CASO CRÍTICO 2: L-Corner Puro (1 columna, 2 filas)
        nueva_fila = obtener_siguiente_fila_vacia(fila_act)

        colocar_en(nueva_fila, col_act, valor_libre) // Enlaza verticalmente en la misma columna
        nuevo_extremo = {valor=valor_libre, fila=nueva_fila, columna=col_act, dir=nueva_fila.direccion}

    actualizar_extremos_abiertos(extremo_elegido -> reemplazar por nuevo_extremo)
    RETORNAR tablero
```
