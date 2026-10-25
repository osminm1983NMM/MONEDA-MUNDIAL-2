// Moneda Mundial 2.0 — historial reciente de créditos ficticios MWD.
// Presentación solamente: no envía dinero, no modifica saldos y no consulta tablas.
import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
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

      <View style={styles.filterGrid}>
        {filters.map(([key,label]) => (
          <TouchableOpacity key={key} accessibilityRole="button"
            accessibilityState={{selected:filter===key}}
            onPress={() => setFilter(key)}
            style={[styles.filterPill, filter===key && styles.filterPillSelected]}>
            <Text style={[styles.filterText, filter===key && styles.filterTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
              </View>
            </View>
            <View style={styles.movementDetailsRow}>
              <View style={styles.movementDetails}>
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
  titleMark:{width:50,height:50,borderRadius:17,backgroundColor:'#202457',borderColor:'#9868FF',borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:11},
  markText:{fontSize:28,color:'#FFD48A',fontWeight:'800'},
  titleWords:{flex:1},
  eyebrow:{fontSize:11,letterSpacing:1.8,color:'#28D6FA',fontWeight:'800'},
  title:{fontSize:25,fontWeight:'800',color:'#FFFFFF',marginTop:2},
  demoPill:{color:'#F8DFA7',borderColor:'#8B6CC6',borderWidth:1,borderRadius:9,paddingHorizontal:7,paddingVertical:7,fontSize:10,fontWeight:'800',maxWidth:100,textAlign:'center'},
  subtitle:{color:'#B8C9E6',fontSize:14,marginBottom:20},
  summaryCard:{backgroundColor:'#111F46',borderWidth:1,borderColor:'#3862BC',borderRadius:20,padding:17,marginBottom:19},
  summaryEyebrow:{color:'#B8EFFF',fontSize:12,fontWeight:'800',letterSpacing:1.1,marginBottom:14},
  summaryColumns:{flexDirection:'row',alignItems:'stretch'},
  summaryColumn:{flex:1,minWidth:0},
  summaryDivider:{width:1,backgroundColor:'#5365A4',marginHorizontal:12},
  summaryLabel:{fontSize:12,color:'#D0DFF4',fontWeight:'700'},
  summaryValue:{fontSize:22,fontWeight:'800',marginTop:7},
  incoming:{color:'#7BE4BC'},outgoing:{color:'#FFCEAD'},
  summaryNote:{color:'#B8C9E6',fontSize:12,lineHeight:18,marginTop:17},
  filterGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:13},
  filterPill:{flexBasis:'47%',flexGrow:1,minWidth:0,justifyContent:'center',alignItems:'center',paddingHorizontal:8,paddingVertical:13,minHeight:48,borderRadius:20,backgroundColor:'#192B55',borderWidth:1,borderColor:'#38538F'},
  filterPillSelected:{backgroundColor:'#3F3DB0',borderColor:'#A18AFF'},
  filterText:{color:'#DAE5FA',fontWeight:'700',fontSize:14,textAlign:'center'},
  filterTextSelected:{color:'#FFFFFF'},
  countText:{color:'#A9C5E5',fontSize:12,letterSpacing:0.3,marginBottom:12},
  emptyCard:{padding:26,backgroundColor:'#111D3B',borderRadius:16,alignItems:'center',marginBottom:12},
  emptyIcon:{fontSize:26,color:'#8BDFFC',marginBottom:10},
  emptyText:{color:'#D6E3F5',textAlign:'center',fontSize:14},
  movementCard:{backgroundColor:'#111D3B',borderWidth:1,borderColor:'#2B3F73',borderRadius:17,padding:15,marginBottom:11},
  movementRow:{flexDirection:'row',alignItems:'center'},
  movementDetailsRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:9},
  movementDetails:{flex:1,minWidth:0},
  directionIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',marginRight:10},
  directionIncoming:{backgroundColor:'#174A4E'},directionOutgoing:{backgroundColor:'#4D3448'},
  arrow:{fontSize:24,fontWeight:'700'},
  movementText:{flex:1,minWidth:0},
  movementLabel:{color:'#F7FBFF',fontSize:14,fontWeight:'700'},
  dateText:{color:'#B8C9E6',fontSize:12,marginTop:5},
  recordText:{color:'#8BDFFC',fontSize:10,marginTop:6,letterSpacing:0.8,fontWeight:'800'},
  amountBox:{alignItems:'flex-end',marginLeft:8,flexShrink:0},
  movementAmount:{fontSize:17,fontWeight:'800'},
  currency:{color:'#B8C9E6',fontSize:12,marginTop:4},
  receiptAction:{borderTopWidth:1,borderTopColor:'#304577',paddingTop:14,marginTop:14,minHeight:44},
  receiptActionText:{color:'#8BDFFC',fontWeight:'800',fontSize:14,textAlign:'center'},
  receiptCard:{backgroundColor:'#0C1733',borderRadius:14,padding:15,marginTop:13,borderWidth:1,borderColor:'#4A4F9C'},
  receiptEyebrow:{color:'#F8DFA7',fontSize:12,letterSpacing:0.4,fontWeight:'800',marginBottom:9},
  receiptCaption:{color:'#D3DDF2',fontSize:13},
  receiptReference:{color:'#8BDFFC',fontSize:13,marginVertical:8},
  receiptLine:{color:'#E1EAF8',fontSize:13,marginTop:7},
  receiptWarning:{color:'#F8DFA7',fontSize:12,marginVertical:12,lineHeight:19},
  shareButton:{backgroundColor:'#3F3DB0',borderRadius:11,padding:15,alignItems:'center'},
  shareText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
  refreshButton:{backgroundColor:'#283F83',borderRadius:13,padding:15,alignItems:'center',marginTop:7,marginBottom:12},
  refreshText:{color:'#EEF7FF',fontSize:14,fontWeight:'700'},
  disabled:{opacity:0.45},
});
