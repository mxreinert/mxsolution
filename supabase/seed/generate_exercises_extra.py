"""Generates supabase/seed/exercises_extra.sql – additional exercises (Sep 2026).
Run: python supabase/seed/generate_exercises_extra.py
Existing IDs are left untouched (on conflict do nothing), so edits made in the dashboard stay.
"""
import os
import re

# id, name, base, pattern, primary_muscle, secondary, equipment, unilateral, tracking_type, level, alt1, alt2
X = [
    # ---------- Rücken: Rudern ----------
    ('RUE_RU_KA_BR', 'Kabelrudern sitzend, breiter Griff (oberer Rücken)', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Hintere Schulter', 'Bizeps'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'RUE_RU_KA', 'RUE_RU_MA'),
    ('RUE_RU_KA_EN', 'Kabelrudern sitzend, enger Griff / V-Griff (Lat)', 'Rudern', 'Horizontal Ziehen', 'Rücken (Lat)', ['Bizeps', 'Oberer Rücken'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'RUE_RU_KA', 'RUE_RU_KA_EA'),
    ('RUE_RU_KA_EA', 'Kabelrudern einarmig', 'Rudern', 'Horizontal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Kabel', True, 'weight_reps', 'Einsteiger', 'RUE_RU_KH', 'RUE_RU_KA_EN'),
    ('RUE_RU_LH_UG', 'Langhantelrudern Untergriff (Yates Row)', 'Rudern', 'Horizontal Ziehen', 'Rücken (Lat)', ['Bizeps', 'Oberer Rücken'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'RUE_RU_LH', 'RUE_RU_TB'),
    ('RUE_RU_PEN', 'Pendlay-Rudern', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Rücken (Lat)', 'Unterer Rücken'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'RUE_RU_LH', 'RUE_RU_SEAL'),
    ('RUE_RU_MEA', 'Meadows-Rudern (Landmine einarmig)', 'Rudern', 'Horizontal Ziehen', 'Rücken (Lat)', ['Oberer Rücken', 'Bizeps'], 'Langhantel', True, 'weight_reps', 'Fortgeschritten', 'RUE_RU_KH', 'RUE_RU_TB'),
    ('RUE_RU_SEAL', 'Seal Row (auf der Bank liegend)', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Rücken (Lat)', 'Hintere Schulter'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'RUE_RU_KHB', 'RUE_RU_MA'),
    ('RUE_RU_KH_BD', 'Kurzhantelrudern beidarmig vorgebeugt', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Rücken (Lat)', 'Bizeps'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'RUE_RU_LH', 'RUE_RU_KHB'),
    ('RUE_RU_MA_EA', 'Rudermaschine einarmig', 'Rudern', 'Horizontal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Maschine', True, 'weight_reps', 'Einsteiger', 'RUE_RU_MA', 'RUE_RU_KA_EA'),
    ('RUE_RU_MA_PL', 'Rudermaschine Plate-Loaded (z. B. Hammer Strength)', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Rücken (Lat)', 'Bizeps'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'RUE_RU_MA', 'RUE_RU_TB'),
    ('RUE_RU_MP', 'Rudern an der Multipresse', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Rücken (Lat)', 'Bizeps'], 'Multipresse', False, 'weight_reps', 'Einsteiger', 'RUE_RU_LH', 'RUE_RU_MA'),
    ('RUE_RU_INV', 'Umgekehrtes Rudern (Inverted Row)', 'Rudern', 'Horizontal Ziehen', 'Oberer Rücken', ['Bizeps', 'Hintere Schulter'], 'Körpergewicht', False, 'bodyweight_reps', 'Einsteiger', 'RUE_RU_KA_BR', 'RUE_RU_MA'),
    # ---------- Rücken: Latzug, Klimmzug, Pullover ----------
    ('RUE_LZ_V', 'Latzug V-Griff (Neutralgriff)', 'Latzug', 'Vertikal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'RUE_LZ_EN', 'RUE_LZ_KA'),
    ('RUE_LZ_MA', 'Latzug Maschine', 'Latzug', 'Vertikal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'RUE_LZ_KA', 'RUE_KZ_ASS'),
    ('RUE_LZ_KN', 'Latzug kniend einarmig', 'Latzug', 'Vertikal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Kabel', True, 'weight_reps', 'Fortgeschritten', 'RUE_LZ_EA', 'RUE_LZ_V'),
    ('RUE_KZ_NG', 'Klimmzug Neutralgriff (eng)', 'Klimmzug', 'Vertikal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Körpergewicht', False, 'bodyweight_reps', 'Fortgeschritten', 'RUE_KZ', 'RUE_LZ_V'),
    ('RUE_KZ_GEW', 'Klimmzug mit Zusatzgewicht', 'Klimmzug', 'Vertikal Ziehen', 'Rücken (Lat)', ['Bizeps'], 'Körpergewicht', False, 'bodyweight_plus', 'Fortgeschritten', 'RUE_KZ', 'RUE_LZ_KA'),
    ('RUE_PD_KH', 'Pullover Kurzhantel', 'Pullover', 'Vertikal Ziehen', 'Rücken (Lat)', ['Brust', 'Trizeps'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'RUE_PD_KA', 'RUE_PD_MA'),
    ('RUE_PD_MA', 'Pullover Maschine', 'Pullover', 'Vertikal Ziehen', 'Rücken (Lat)', ['Brust'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'RUE_PD_KA', 'RUE_PD_KH'),
    ('RUE_SHR_KA', 'Shrugs Kabel', 'Shrugs', 'Isolation', 'Oberer Rücken', [], 'Kabel', False, 'weight_reps', 'Einsteiger', 'RUE_SHR_KH', 'RUE_SHR_MA'),
    ('RUE_RS_MA', 'Rückenstrecker Maschine', 'Rückenstrecker', 'Hüftstreckung', 'Unterer Rücken', ['Gesäß', 'Beinbeuger'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'RUE_HE', 'BEI_GM'),
    ('RUE_HE_GEW', 'Hyperextensions mit Zusatzgewicht', 'Rückenstrecker', 'Hüftstreckung', 'Unterer Rücken', ['Gesäß', 'Beinbeuger'], 'Körpergewicht', False, 'bodyweight_plus', 'Einsteiger', 'RUE_HE', 'RUE_RS_MA'),
    # ---------- Schultern ----------
    ('SCH_RF_KH', 'Reverse Fly Kurzhantel vorgebeugt', 'Reverse Fly', 'Isolation', 'Hintere Schulter', ['Oberer Rücken'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'SCH_RF_MA', 'SCH_RF_KA'),
    ('SCH_RD_RU', 'Rear Delt Row Kurzhantel', 'Reverse Fly', 'Horizontal Ziehen', 'Hintere Schulter', ['Oberer Rücken'], 'Kurzhantel', True, 'weight_reps', 'Fortgeschritten', 'SCH_RF_KH', 'SCH_FP_KA'),
    ('SCH_SH_SI', 'Seitheben Kurzhantel sitzend', 'Seitheben', 'Isolation', 'Seitliche Schulter', [], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'SCH_SH_KH', 'SCH_SH_MA'),
    ('SCH_SH_LA', 'Seitheben schräg (Lean-Away) einarmig', 'Seitheben', 'Isolation', 'Seitliche Schulter', [], 'Kurzhantel', True, 'weight_reps', 'Fortgeschritten', 'SCH_SH_KA', 'SCH_SH_KH'),
    ('SCH_SH_KA_BD', 'Seitheben Kabel beidarmig (Y-Raise)', 'Seitheben', 'Isolation', 'Seitliche Schulter', ['Oberer Rücken'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'SCH_SH_KA', 'SCH_SH_KH'),
    ('SCH_UR_KA', 'Aufrechtes Rudern Kabel (Upright Row)', 'Aufrechtes Rudern', 'Vertikal Ziehen', 'Seitliche Schulter', ['Oberer Rücken', 'Bizeps'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'SCH_UR_SZ', 'SCH_SH_KH'),
    ('SCH_UR_SZ', 'Aufrechtes Rudern SZ-Stange', 'Aufrechtes Rudern', 'Vertikal Ziehen', 'Seitliche Schulter', ['Oberer Rücken', 'Bizeps'], 'SZ-Stange', False, 'weight_reps', 'Einsteiger', 'SCH_UR_KA', 'SCH_SH_KH'),
    ('SCH_AP', 'Arnold Press', 'Schulterdrücken', 'Vertikal Drücken', 'Vordere Schulter', ['Seitliche Schulter', 'Trizeps'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'SCH_SD_KH', 'SCH_SD_MA'),
    ('SCH_SD_KH_ST', 'Kurzhantel-Schulterdrücken stehend', 'Schulterdrücken', 'Vertikal Drücken', 'Vordere Schulter', ['Trizeps', 'Seitliche Schulter'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'SCH_SD_KH', 'SCH_SD_LH'),
    ('SCH_LMP', 'Landmine Press einarmig', 'Schulterdrücken', 'Vertikal Drücken', 'Vordere Schulter', ['Brust', 'Trizeps'], 'Langhantel', True, 'weight_reps', 'Fortgeschritten', 'SCH_SD_KH', 'SCH_AP'),
    # ---------- Brust ----------
    ('BRU_FLY_KA_TI', 'Cable Fly von unten (obere Brust)', 'Fliegende', 'Isolation', 'Brust', ['Vordere Schulter'], 'Kabel', False, 'weight_reps', 'Einsteiger', 'BRU_FLY_KA', 'BRU_FLY_SKH'),
    ('BRU_FLY_KA_HO', 'Cable Fly von oben (untere Brust)', 'Fliegende', 'Isolation', 'Brust', [], 'Kabel', False, 'weight_reps', 'Einsteiger', 'BRU_FLY_KA', 'BRU_FLY_MA'),
    ('BRU_FLY_SKH', 'Schrägbank-Fliegende Kurzhantel', 'Fliegende', 'Isolation', 'Brust', ['Vordere Schulter'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'BRU_FLY_KA_TI', 'BRU_FLY_KH'),
    ('BRU_SBP_MA', 'Schrägbankpresse Maschine', 'Schrägbankdrücken', 'Horizontal Drücken', 'Brust', ['Vordere Schulter', 'Trizeps'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'BRU_SBD_KH', 'BRU_SBD_MP'),
    ('BRU_NBD_LH', 'Negativbankdrücken', 'Bankdrücken', 'Horizontal Drücken', 'Brust', ['Trizeps'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'BRU_BD_LH', 'BRU_DIP'),
    ('BRU_LS_GEW', 'Liegestütz mit Zusatzgewicht', 'Liegestütz', 'Horizontal Drücken', 'Brust', ['Trizeps', 'Vordere Schulter'], 'Körpergewicht', False, 'bodyweight_plus', 'Fortgeschritten', 'BRU_LS', 'BRU_BD_KH'),
    # ---------- Bizeps ----------
    ('BIZ_SPI', 'Spider Curls', 'Curls', 'Isolation', 'Bizeps', [], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'BIZ_SC', 'BIZ_KONZ'),
    ('BIZ_BAY', 'Bayesian Curls (Kabel von hinten, einarmig)', 'Curls', 'Isolation', 'Bizeps', [], 'Kabel', True, 'weight_reps', 'Fortgeschritten', 'BIZ_IC', 'BIZ_CU_KA_EA'),
    ('BIZ_KONZ', 'Konzentrationscurls', 'Curls', 'Isolation', 'Bizeps', [], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'BIZ_SC_KH', 'BIZ_SPI'),
    ('BIZ_DRAG', 'Drag Curls', 'Curls', 'Isolation', 'Bizeps', [], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'BIZ_CU_LH', 'BIZ_CU_SZ'),
    ('BIZ_SC_KH', 'Scottcurls Kurzhantel einarmig', 'Curls', 'Isolation', 'Bizeps', [], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'BIZ_SC', 'BIZ_SC_MA'),
    ('BIZ_CU_KA_EA', 'Kabelcurls einarmig', 'Curls', 'Isolation', 'Bizeps', [], 'Kabel', True, 'weight_reps', 'Einsteiger', 'BIZ_CU_KA', 'BIZ_BAY'),
    ('BIZ_CU_KA_OH', 'Kabelcurls über Kopf (Doppelbizeps)', 'Curls', 'Isolation', 'Bizeps', [], 'Kabel', False, 'weight_reps', 'Fortgeschritten', 'BIZ_CU_KA', 'BIZ_BAY'),
    ('BIZ_CU_KH_SI', 'Kurzhantel-Curls sitzend', 'Curls', 'Isolation', 'Bizeps', [], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'BIZ_CU_KH', 'BIZ_IC'),
    ('BIZ_HC_CB', 'Hammercurls quer vor dem Körper (Cross-Body)', 'Hammercurls', 'Isolation', 'Bizeps', ['Unterarme'], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'BIZ_HC_KH', 'BIZ_HC_KA'),
    ('BIZ_ZOT', 'Zottman Curls', 'Curls', 'Isolation', 'Bizeps', ['Unterarme'], 'Kurzhantel', False, 'weight_reps', 'Fortgeschritten', 'BIZ_HC_KH', 'UNT_RC'),
    ('BIZ_CU_SZ_EN', 'SZ-Curls enger Griff', 'Curls', 'Isolation', 'Bizeps', [], 'SZ-Stange', False, 'weight_reps', 'Einsteiger', 'BIZ_CU_SZ', 'BIZ_CU_LH'),
    ('BIZ_CU_KA_ST', 'Kabelcurls mit Stange', 'Curls', 'Isolation', 'Bizeps', [], 'Kabel', False, 'weight_reps', 'Einsteiger', 'BIZ_CU_KA', 'BIZ_CU_SZ'),
    # ---------- Trizeps ----------
    ('TRI_PD_EA', 'Trizepsdrücken einarmig Kabel', 'Trizepsdrücken', 'Isolation', 'Trizeps', [], 'Kabel', True, 'weight_reps', 'Einsteiger', 'TRI_PD_SE', 'TRI_KB_KA'),
    ('TRI_PD_UG', 'Trizepsdrücken Untergriff', 'Trizepsdrücken', 'Isolation', 'Trizeps', [], 'Kabel', False, 'weight_reps', 'Einsteiger', 'TRI_PD_ST', 'TRI_PD_EA'),
    ('TRI_PD_V', 'Trizepsdrücken V-Griff', 'Trizepsdrücken', 'Isolation', 'Trizeps', [], 'Kabel', False, 'weight_reps', 'Einsteiger', 'TRI_PD_ST', 'TRI_PD_SE'),
    ('TRI_UK_KA_EA', 'Überkopf-Trizepsstrecken Kabel einarmig', 'Überkopf-Trizepsstrecken', 'Isolation', 'Trizeps', [], 'Kabel', True, 'weight_reps', 'Fortgeschritten', 'TRI_UK_KA', 'TRI_UK_KH'),
    ('TRI_UK_SZ', 'Überkopf-Trizepsstrecken SZ-Stange', 'Überkopf-Trizepsstrecken', 'Isolation', 'Trizeps', [], 'SZ-Stange', False, 'weight_reps', 'Einsteiger', 'TRI_UK_KA', 'TRI_UK_KH'),
    ('TRI_UK_MA', 'Trizepsstrecken Maschine', 'Überkopf-Trizepsstrecken', 'Isolation', 'Trizeps', [], 'Maschine', False, 'weight_reps', 'Einsteiger', 'TRI_UK_KA', 'TRI_DIP_MA'),
    ('TRI_KB_KH', 'Trizeps-Kickbacks Kurzhantel', 'Kickbacks', 'Isolation', 'Trizeps', [], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'TRI_KB_KA', 'TRI_PD_EA'),
    ('TRI_KB_KA', 'Trizeps-Kickbacks Kabel', 'Kickbacks', 'Isolation', 'Trizeps', [], 'Kabel', True, 'weight_reps', 'Einsteiger', 'TRI_KB_KH', 'TRI_PD_EA'),
    ('TRI_SC_KH', 'Skullcrusher Kurzhantel', 'French Press', 'Isolation', 'Trizeps', [], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'TRI_SC', 'TRI_SC_KA'),
    ('TRI_SC_KA', 'Liegendes Trizepsstrecken Kabel', 'French Press', 'Isolation', 'Trizeps', [], 'Kabel', False, 'weight_reps', 'Fortgeschritten', 'TRI_SC', 'TRI_UK_KA'),
    ('TRI_JM', 'JM Press', 'Enges Drücken', 'Horizontal Drücken', 'Trizeps', ['Brust'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'TRI_BDE', 'TRI_SC'),
    ('TRI_TATE', 'Tate Press', 'French Press', 'Isolation', 'Trizeps', [], 'Kurzhantel', False, 'weight_reps', 'Fortgeschritten', 'TRI_SC_KH', 'TRI_SC'),
    ('TRI_DIP', 'Dips (Trizeps, aufrecht)', 'Dips', 'Vertikal Drücken', 'Trizeps', ['Brust', 'Vordere Schulter'], 'Körpergewicht', False, 'bodyweight_reps', 'Fortgeschritten', 'TRI_DIP_MA', 'TRI_BANK'),
    ('TRI_BANK', 'Bankdips', 'Dips', 'Vertikal Drücken', 'Trizeps', ['Vordere Schulter'], 'Körpergewicht', False, 'bodyweight_reps', 'Einsteiger', 'TRI_DIP_MA', 'TRI_DIP'),
    ('TRI_LS_EN', 'Enge Liegestütze (Diamond Push-Ups)', 'Liegestütz', 'Horizontal Drücken', 'Trizeps', ['Brust'], 'Körpergewicht', False, 'bodyweight_reps', 'Einsteiger', 'TRI_BDE', 'TRI_BANK'),
    # ---------- Beine ----------
    ('BEI_BP_EB', 'Beinpresse einbeinig', 'Beinpresse', 'Kniebeuge', 'Quadrizeps', ['Gesäß'], 'Maschine', True, 'weight_reps', 'Einsteiger', 'BEI_BP', 'BEI_BU'),
    ('BEI_SSQ', 'Sissy Squat', 'Kniebeuge', 'Kniebeuge', 'Quadrizeps', [], 'Körpergewicht', False, 'bodyweight_reps', 'Fortgeschritten', 'BEI_BS', 'BEI_HS'),
    ('BEI_BELT', 'Belt Squat', 'Kniebeuge', 'Kniebeuge', 'Quadrizeps', ['Gesäß'], 'Maschine', False, 'weight_reps', 'Einsteiger', 'BEI_HS', 'BEI_BP'),
    ('BEI_AS_RU', 'Ausfallschritte rückwärts', 'Ausfallschritte', 'Ausfallschritt', 'Quadrizeps', ['Gesäß'], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'BEI_AS_KH', 'BEI_BU'),
    ('BEI_KB_ZE', 'Kniebeuge mit erhöhten Fersen (Heel-Elevated)', 'Kniebeuge', 'Kniebeuge', 'Quadrizeps', ['Gesäß'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'BEI_GS_KH', 'BEI_FS_LH'),
    ('BEI_BC_ST', 'Beinbeuger stehend einbeinig', 'Beinbeuger', 'Isolation', 'Beinbeuger', [], 'Maschine', True, 'weight_reps', 'Einsteiger', 'BEI_BC_SI', 'BEI_BC_LI'),
    ('BEI_KH_SU', 'Sumo-Kreuzheben', 'Kreuzheben', 'Hüftstreckung', 'Gesäß', ['Beinbeuger', 'Adduktoren', 'Unterer Rücken'], 'Langhantel', False, 'weight_reps', 'Fortgeschritten', 'BEI_KH_LH', 'BEI_TB'),
    ('BEI_RDL_MP', 'Rumänisches Kreuzheben Multipresse', 'Kreuzheben', 'Hüftstreckung', 'Beinbeuger', ['Gesäß'], 'Multipresse', False, 'weight_reps', 'Einsteiger', 'BEI_RDL_LH', 'BEI_RDL_KH'),
    ('GES_KB_MA', 'Glute Kickback Maschine', 'Kickbacks', 'Hüftstreckung', 'Gesäß', [], 'Maschine', True, 'weight_reps', 'Einsteiger', 'GES_KB_KA', 'GES_HT_MA'),
    ('GES_ABD_KA', 'Abduktion Kabel stehend', 'Abduktion', 'Isolation', 'Gesäß', [], 'Kabel', True, 'weight_reps', 'Einsteiger', 'GES_ABD', 'GES_KB_KA'),
    ('GES_HT_MP', 'Hip Thrust Multipresse', 'Hip Thrust', 'Hüftstreckung', 'Gesäß', ['Beinbeuger'], 'Multipresse', False, 'weight_reps', 'Einsteiger', 'GES_HT_LH', 'GES_HT_MA'),
    ('GES_HT_EB', 'Hip Thrust einbeinig', 'Hip Thrust', 'Hüftstreckung', 'Gesäß', ['Beinbeuger'], 'Körpergewicht', True, 'bodyweight_plus', 'Einsteiger', 'GES_HT_LH', 'GES_GB'),
    ('WAD_EB', 'Wadenheben einbeinig', 'Wadenheben', 'Isolation', 'Waden', [], 'Kurzhantel', True, 'weight_reps', 'Einsteiger', 'WAD_ST_MA', 'WAD_MP'),
    ('WAD_MP', 'Wadenheben Multipresse', 'Wadenheben', 'Isolation', 'Waden', [], 'Multipresse', False, 'weight_reps', 'Einsteiger', 'WAD_ST_MA', 'WAD_BP'),
    # ---------- Bauch, Unterarme ----------
    ('BAU_BH_L', 'Beinheben liegend', 'Beinheben', 'Rumpf', 'Bauch', [], 'Körpergewicht', False, 'bodyweight_reps', 'Einsteiger', 'BAU_BH_H', 'BAU_KNIE'),
    ('BAU_KNIE', 'Knieheben am Dip-Stuhl (Captain’s Chair)', 'Beinheben', 'Rumpf', 'Bauch', [], 'Körpergewicht', False, 'bodyweight_reps', 'Einsteiger', 'BAU_BH_H', 'BAU_BH_L'),
    ('BAU_RT', 'Russian Twist', 'Rotation', 'Rumpf', 'Bauch', [], 'Körpergewicht', False, 'bodyweight_plus', 'Einsteiger', 'BAU_WOOD', 'BAU_PA'),
    ('BAU_WOOD', 'Holzhacker Kabel (Woodchopper)', 'Rotation', 'Rumpf', 'Bauch', [], 'Kabel', True, 'weight_reps', 'Einsteiger', 'BAU_PA', 'BAU_RT'),
    ('BAU_CR_NB', 'Crunch auf der Negativbank', 'Crunch', 'Rumpf', 'Bauch', [], 'Körpergewicht', False, 'bodyweight_plus', 'Einsteiger', 'BAU_CR', 'BAU_CR_KA'),
    ('BAU_HOL', 'Hollow Hold', 'Halteübung', 'Rumpf', 'Bauch', [], 'Körpergewicht', False, 'time', 'Einsteiger', 'BAU_PL', 'BAU_DB'),
    ('UNT_RWC', 'Reverse Wrist Curls', 'Handgelenk-Curls', 'Isolation', 'Unterarme', [], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'UNT_WC', 'UNT_RC'),
    ('UNT_FW', 'Farmer’s Walk', 'Tragen', 'Tragen', 'Unterarme', ['Oberer Rücken', 'Bauch'], 'Kurzhantel', False, 'weight_reps', 'Einsteiger', 'CAR_SW', 'RUE_SHR_KH'),
]

HERE = os.path.dirname(os.path.abspath(__file__))
existing = set(re.findall(r"^  \('([A-Z0-9_]+)'", open(os.path.join(HERE, 'exercises.sql'), encoding='utf-8').read(), re.M))
ids = [x[0] for x in X]
assert len(ids) == len(set(ids)), 'duplicate id'
for x in X:
    assert re.fullmatch(r'[A-Z0-9_]{3,40}', x[0]), x[0]
    assert x[0] not in existing, 'already exists: ' + x[0]
    for alt in x[10:12]:
        assert alt in existing or alt in ids, f'{x[0]}: unknown alt {alt}'


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    return "'" + str(v).replace("'", "''") + "'"


rows = []
for i, (id_, name, base, pattern, prim, sec, equip, uni, track, level, a1, a2) in enumerate(X):
    arr = 'array[' + ','.join(lit(s) for s in sec) + ']::text[]'
    rows.append(f"  ({lit(id_)}, {lit(name)}, {lit(base)}, {lit(pattern)}, {lit(prim)}, {arr}, {lit(equip)}, {lit(uni)}, {lit(track)}, {lit(level)}, {lit(a1)}, {lit(a2)}, null, null, true, {200 + i})")

sql = """-- Additional exercises (generated by supabase/seed/generate_exercises_extra.py – do not edit by hand).
-- Run in the Supabase SQL editor after exercises.sql. Existing IDs are not touched.
begin;
set constraints all deferred;
insert into public.exercises
  (id, name, base, pattern, primary_muscle, secondary, equipment, unilateral, tracking_type, level, alt1, alt2, video_url, hint, active, sort)
values
""" + ',\n'.join(rows) + """
on conflict (id) do nothing;
commit;
"""
open(os.path.join(HERE, 'exercises_extra.sql'), 'w', encoding='utf-8').write(sql)
print(len(X), 'exercises written')
