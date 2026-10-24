// Moneda Mundial 2.0 — historial reciente de créditos ficticios MWD.
// Presentación solamente: no envía dinero, no modifica saldos y no consulta tablas.
import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {classifyDemoOperation} from './src/demo-receipts.mjs';
import {formatMWD} from './src/demo-money.mjs';
import {translate, formatLocalizedDate} from './src/i18n.mjs';
import {
  prepareRecentDemoHistory, summarizeRecentDemoHistory, filterRecentDemoHistory,
} from './src/demo-history-view.mjs';

const COPY = {
  es: {
    title:'Tu actividad', eyebrow:'HISTORIAL', subtitle:'Movimientos recientes de tu billetera de prueba',
    demo:'SOLO DEMOSTRACIÓN', incoming:'Entradas', outgoing:'Salidas',
    all:'Todos', merchant:'Comercios', movements:'movimientos visibles',
    summary:'Resumen de los movimientos recientes cargados; no es tu saldo total.',
    empty:'No hay movimientos de prueba en esta selección.', registered:'REGISTRO DE PRUEBA',
    receipt:'Ver comprobante', hide:'Ocultar comprobante', demoReceipt:'COMPROBANTE FICTICIO · SIN DINERO REAL',
    reference:'Referencia:', type:'Tipo:', amount:'Monto:', date:'Fecha:',
    disclaimer:'Este documento no acredita un movimiento de dinero real.',
    share:'Compartir comprobante ficticio', refresh:'Actualizar movimientos', updating:'Actualizando...',
  },
  en: {
    title:'Your activity', eyebrow:'HISTORY', subtitle:'Recent activity in your demo wallet',
    demo:'DEMO ONLY', incoming:'Incoming', outgoing:'Outgoing',
    all:'All', merchant:'Merchants', movements:'visible transactions',
    summary:'Summary of recently loaded transactions; not your total balance.',
    empty:'No demo transactions match this filter.', registered:'DEMO RECORD',
    receipt:'View receipt', hide:'Hide receipt', demoReceipt:'FICTIONAL RECEIPT · NO REAL MONEY',
    reference:'Reference:', type:'Type:', amount:'Amount:', date:'Date:',
    disclaimer:'This document is not evidence of a real-money transaction.',
    share:'Share demo receipt', refresh:'Refresh transactions', updating:'Refreshing...',
  },
};

export default function DemoHistoryRecentScreen({
  operations, userId, language='es', selectedReceiptId, setSelectedReceiptId,
  onShareReceipt, onRefresh, refreshing=false, allowShare=true, allowRefresh=true,
}) {
  const t = COPY[language] || COPY.es;
  const [filter, setFilter] = useState('all');
  const rows = useMemo(
    () => prepareRecentDemoHistory(operations, userId, classifyDemoOperation),
    [operations, userId],
  );
  const totals = useMemo(() => summarizeRecentDemoHistory(rows), [rows]);
  const shown = useMemo(() => filterRecentDemoHistory(rows, filter), [rows, filter]);
  const filters = [
    ['all', t.all], ['incoming', t.incoming],
    ['outgoing', t.outgoing], ['merchant', t.merchant],
  ];

  return (
    <View>
      <View style={styles.titleRow}>
        <View style={styles.titleMark}><Text style={styles.markText}>◷</Text></View>
        <View style={styles.titleWords}>
          <Text style={styles.eyebrow}>{t.eyebrow}</Text>
          <Text style={styles.title}>{t.title}</Text>
        </View>
        <Text style={styles.demoPill}>{t.demo}</Text>
      </View>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>MWD · DEMO</Text>
        <View style={styles.summaryColumns}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>↙  {t.incoming} ({totals.incomingCount})</Text>
            <Text style={[styles.summaryValue, styles.incoming]}>+{formatMWD(totals.incomingCents)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>↗  {t.outgoing} ({totals.outgoingCount})</Text>
            <Text style={[styles.summaryValue, styles.outgoing]}>−{formatMWD(totals.outgoingCents)}</Text>
          </View>
        </View>
        <Text style={styles.summaryNote}>{t.summary}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}>
        {filters.map(([key,label]) => (
          <TouchableOpacity key={key} accessibilityRole="button"
            accessibilityState={{selected:filter===key}}
            onPress={() => setFilter(key)}
            style={[styles.filterPill, filter===key && styles.filterPillSelected]}>
            <Text style={[styles.filterText, filter===key && styles.filterTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.countText}>{shown.length} {t.movements}</Text>
      {shown.length===0 && <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>▤</Text>
        <Text style={styles.emptyText}>{t.empty}</Text>
      </View>}
      {shown.map(row => {
        const op=row.operation;
        const isIncoming=row.direction==='incoming';
        const expanded=selectedReceiptId===row.id;
        return (
          <View style={styles.movementCard} key={row.id}>
            <View style={styles.movementRow}>
              <View style={[styles.directionIcon, isIncoming ? styles.directionIncoming : styles.directionOutgoing]}>
                <Text style={[styles.arrow, isIncoming ? styles.incoming : styles.outgoing]}>
                  {isIncoming ? '↙' : '↗'}
                </Text>
              </View>
              <View style={styles.movementText}>
                <Text style={styles.movementLabel}>{translate(row.movement.label,language)}</Text>
                <Text style={styles.dateText}>{formatLocalizedDate(op.created_at,language)}</Text>
                <Text style={styles.recordText}>{t.registered}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={[styles.movementAmount,isIncoming ? styles.incoming : styles.outgoing]}>
                  {row.movement.sign}{formatMWD(op.amount_cents)}
                </Text>
                <Text style={styles.currency}>MWD</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" style={styles.receiptAction}
              onPress={() => setSelectedReceiptId(expanded ? null : row.id)}>
              <Text style={styles.receiptActionText}>{expanded ? t.hide : t.receipt} {expanded ? '⌃' : '⌄'}</Text>
            </TouchableOpacity>
            {expanded && <View style={styles.receiptCard}>
              <Text style={styles.receiptEyebrow}>{t.demoReceipt}</Text>
              <Text style={styles.receiptCaption}>{t.reference}</Text>
              <Text selectable style={styles.receiptReference}>{op.id}</Text>
              <Text style={styles.receiptLine}>{t.type} {translate(row.movement.label,language)}</Text>
              <Text style={styles.receiptLine}>{t.amount} {row.movement.sign}{formatMWD(op.amount_cents)} MWD</Text>
              <Text style={styles.receiptLine}>{t.date} {formatLocalizedDate(op.created_at,language)}</Text>
              <Text style={styles.receiptWarning}>{t.disclaimer}</Text>
              {allowShare && typeof onShareReceipt === 'function' &&
                <TouchableOpacity accessibilityRole="button" style={styles.shareButton}
                  onPress={() => onShareReceipt(op)}>
                  <Text style={styles.shareText}>{t.share}</Text>
                </TouchableOpacity>}
            </View>}
          </View>
        );
      })}
      {allowRefresh && typeof onRefresh === 'function' &&
        <TouchableOpacity accessibilityRole="button" disabled={refreshing}
          accessibilityState={{disabled:refreshing}}
          style={[styles.refreshButton, refreshing && styles.disabled]}
          onPress={onRefresh}>
          <Text style={styles.refreshText}>{refreshing ? t.updating : t.refresh}</Text>
        </TouchableOpacity>}
    </View>
  );
}

const styles=StyleSheet.create({
  titleRow:{flexDirection:'row',alignItems:'center',marginBottom:8},
  titleMark:{width:48,height:48,borderRadius:16,backgroundColor:'#193D51',borderColor:'#42849A',borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:11},
  markText:{fontSize:28,color:'#D2B778',fontWeight:'800'},
  titleWords:{flex:1},
  eyebrow:{fontSize:10,letterSpacing:1.8,color:'#7FE0CA',fontWeight:'800'},
  title:{fontSize:25,fontWeight:'800',color:'#FFFFFF',marginTop:2},
  demoPill:{color:'#F4D49D',borderColor:'#857446',borderWidth:1,borderRadius:9,paddingHorizontal:7,paddingVertical:6,fontSize:9,fontWeight:'800',maxWidth:100,textAlign:'center'},
  subtitle:{color:'#ABBECC',fontSize:13,marginBottom:20},
  summaryCard:{backgroundColor:'#123849',borderWidth:1,borderColor:'#2B7580',borderRadius:20,padding:17,marginBottom:19},
  summaryEyebrow:{color:'#BDE7E5',fontSize:11,fontWeight:'800',letterSpacing:1.1,marginBottom:14},
  summaryColumns:{flexDirection:'row',alignItems:'stretch'},
  summaryColumn:{flex:1,minWidth:0},
  summaryDivider:{width:1,backgroundColor:'#466C7D',marginHorizontal:12},
  summaryLabel:{fontSize:11,color:'#BBD1DA',fontWeight:'700'},
  summaryValue:{fontSize:22,fontWeight:'800',marginTop:7},
  incoming:{color:'#82E5C8'},outgoing:{color:'#F0C997'},
  summaryNote:{color:'#A5BBC6',fontSize:10,lineHeight:16,marginTop:17},
  filterScroll:{marginBottom:13},filterContent:{gap:8,paddingRight:8},
  filterPill:{paddingHorizontal:16,paddingVertical:11,borderRadius:20,backgroundColor:'#173247',borderWidth:1,borderColor:'#2B4F64'},
  filterPillSelected:{backgroundColor:'#117D7C',borderColor:'#51CFC3'},
  filterText:{color:'#BBD1DC',fontWeight:'700',fontSize:12},
  filterTextSelected:{color:'#FFFFFF'},
  countText:{color:'#94B5C4',fontSize:11,letterSpacing:0.3,marginBottom:12},
  emptyCard:{padding:26,backgroundColor:'#10293A',borderRadius:16,alignItems:'center',marginBottom:12},
  emptyIcon:{fontSize:26,color:'#8FC1CB',marginBottom:10},
  emptyText:{color:'#C5D4DE',textAlign:'center',fontSize:13},
  movementCard:{backgroundColor:'#10293A',borderWidth:1,borderColor:'#25495A',borderRadius:16,padding:14,marginBottom:11},
  movementRow:{flexDirection:'row',alignItems:'center'},
  directionIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',marginRight:10},
  directionIncoming:{backgroundColor:'#15483E'},directionOutgoing:{backgroundColor:'#49372C'},
  arrow:{fontSize:24,fontWeight:'700'},
  movementText:{flex:1,minWidth:0},
  movementLabel:{color:'#F6FBFF',fontSize:13,fontWeight:'700'},
  dateText:{color:'#9CB7C4',fontSize:11,marginTop:5},
  recordText:{color:'#80C7C3',fontSize:9,marginTop:6,letterSpacing:0.8,fontWeight:'800'},
  amountBox:{alignItems:'flex-end',marginLeft:8},
  movementAmount:{fontSize:17,fontWeight:'800'},
  currency:{color:'#A9C1CC',fontSize:11,marginTop:4},
  receiptAction:{borderTopWidth:1,borderTopColor:'#244A5C',paddingTop:12,marginTop:14},
  receiptActionText:{color:'#90DFD2',fontWeight:'700',fontSize:12,textAlign:'center'},
  receiptCard:{backgroundColor:'#0A2231',borderRadius:12,padding:14,marginTop:13,borderWidth:1,borderColor:'#285260'},
  receiptEyebrow:{color:'#F3D49A',fontSize:10,letterSpacing:0.4,fontWeight:'800',marginBottom:9},
  receiptCaption:{color:'#AEC8D4',fontSize:12},
  receiptReference:{color:'#84DFCE',fontSize:12,marginVertical:8},
  receiptLine:{color:'#D5E6EA',fontSize:12,marginTop:7},
  receiptWarning:{color:'#F3D49A',fontSize:11,marginVertical:12,lineHeight:18},
  shareButton:{backgroundColor:'#1C6F77',borderRadius:11,padding:13,alignItems:'center'},
  shareText:{color:'#FFFFFF',fontSize:12,fontWeight:'800'},
  refreshButton:{backgroundColor:'#254559',borderRadius:13,padding:15,alignItems:'center',marginTop:7,marginBottom:12},
  refreshText:{color:'#E2F4F3',fontSize:13,fontWeight:'700'},
  disabled:{opacity:0.45},
});
