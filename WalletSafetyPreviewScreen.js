import React,{useState} from 'react';
import {View,Text,TextInput} from 'react-native';
import {previewWatchOnlyTransferResearch} from './src/digital-money/watch-only-transfer-preview.mjs';
import {RESEARCH_CHAINS} from './src/digital-money/watch-only-wallet-policy.mjs';

// Solo revisión local de formato de direcciones públicas. No hay wallet, RPC,
// firma, permisos de cámara, AsyncStorage, Supabase, transacción ni saldo.
const s={
 card:{backgroundColor:'#142c43',borderRadius:12,padding:14,marginVertical:10},
 title:{color:'#f4f8fc',fontWeight:'700',marginVertical:8},
 text:{color:'#dceaf4',marginVertical:7},
 warn:{color:'#f5c989',marginVertical:7},
 input:{borderRadius:7,backgroundColor:'#28465c',color:'#fff',
        padding:10,marginVertical:7},
};

export default function WalletSafetyPreviewScreen(){
 const [sender,setSender]=useState('');
 const [recipient,setRecipient]=useState('');
 const [amount,setAmount]=useState('');
 const data=previewWatchOnlyTransferResearch({
  asset:'moneda_mundial_coin_research',
  chainId:RESEARCH_CHAINS.baseSepolia.chainId,
  senderAddress:sender,recipientAddress:recipient,amountUnits:amount,
 });
 return <View style={s.card}>
   <Text style={s.title}>BILLETERA COIN · REVISIÓN EDUCATIVA EN TESTNET</Text>
   <Text style={s.warn}>No conectamos una billetera. No envíes monedas a estas direcciones usando esta pantalla.</Text>
   <Text style={s.text}>Red exclusiva de investigación: Base Sepolia (84532). No es la red final.</Text>
   <Text style={s.warn}>Introduce únicamente direcciones PÚBLICAS de prueba. Nunca escribas claves privadas, contraseñas o frases de recuperación.</Text>
   <Text style={s.text}>Dirección pública de prueba del remitente</Text>
   <TextInput style={s.input} value={sender} onChangeText={setSender}
     placeholder="0x... (40 caracteres hexadecimales)"
     placeholderTextColor="#abc1d0" autoCorrect={false}
     autoCapitalize="none" maxLength={42} />
   <Text style={s.text}>Dirección pública de prueba del destinatario</Text>
   <TextInput style={s.input} value={recipient} onChangeText={setRecipient}
     placeholder="0x... (no reutilizar la misma)"
     placeholderTextColor="#abc1d0" autoCorrect={false}
     autoCapitalize="none" maxLength={42} />
   <Text style={s.text}>Cantidad ficticia entera de Coin (sin valor real)</Text>
   <TextInput style={s.input} value={amount} onChangeText={setAmount}
     keyboardType="number-pad" placeholder="Ejemplo: 100"
     placeholderTextColor="#abc1d0" maxLength={18}/>
   {data.valid
    ? <View>
       <Text style={s.text}>Formato de direcciones: compatible con el estudio de Base Sepolia.</Text>
       <Text style={s.text}>Cantidad ficticia: {data.hypotheticalAmountUnits} Coin imaginarias</Text>
       <Text style={s.warn}>La propiedad de estas direcciones y la identidad del beneficiario NO están verificadas.</Text>
       <Text style={s.warn}>No se comprobaron contrato, saldo, gas ni posibilidad de recibir.</Text>
      </View>
    : <Text style={s.warn}>Introduce dos direcciones públicas de prueba diferentes y una cantidad entera positiva para revisar su formato.</Text>}
   <Text style={s.warn}>ENVIAR: NO DISPONIBLE · FIRMAR: NO DISPONIBLE · DINERO REAL: BLOQUEADO.</Text>
 </View>;
}
