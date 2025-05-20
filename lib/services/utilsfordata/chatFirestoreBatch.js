'use client';

import { writeBatch } from 'firebase/firestore';
import { firebasedb } from '../../firebaseCli';
import { log, handleFirestoreError } from './chatFirebaseUtils';

/**
 * Firestore 배치 처리를 위한 클래스
 * 다수의 Firestore 작업을 그룹화하여 원자적으로 처리하기 위한 유틸리티
 */
export class FirestoreBatch {
  /**
   * FirestoreBatch 생성자
   */
  constructor() {
    this.batch = writeBatch(firebasedb);
    this.operationCount = 0;
    this.maxOperations = 500; // Firestore 제한: 배치당 최대 500개 작업
    this.pendingCommits = [];
    log('새 FirestoreBatch 인스턴스 생성됨');
  }

  /**
   * 배치에 작업 추가
   * @param {function} operation - 배치에 작업을 추가하는 함수
   * @returns {FirestoreBatch} 현재 인스턴스 (체인 호출을 위해)
   */
  add(operation) {
    // 현재 배치가 최대 작업 수에 도달한 경우, 새 배치 생성
    if (this.operationCount >= this.maxOperations) {
      this.pendingCommits.push(this.batch);
      this.batch = writeBatch(firebasedb);
      this.operationCount = 0;
      log(`최대 작업 수 도달, 새 배치 생성 (전체 배치: ${this.pendingCommits.length + 1})`);
    }

    // 작업 수행
    operation(this.batch);
    this.operationCount++;
    return this;
  }

  /**
   * 문서 생성 작업 추가
   * @param {DocumentReference} ref - 문서 참조
   * @param {Object} data - 문서 데이터
   * @returns {FirestoreBatch} 현재 인스턴스
   */
  create(ref, data) {
    return this.add(batch => batch.create(ref, data));
  }

  /**
   * 문서 설정 작업 추가 (존재하는 문서 덮어쓰기)
   * @param {DocumentReference} ref - 문서 참조
   * @param {Object} data - 문서 데이터
   * @returns {FirestoreBatch} 현재 인스턴스
   */
  set(ref, data, options) {
    return this.add(batch => batch.set(ref, data, options));
  }

  /**
   * 문서 업데이트 작업 추가
   * @param {DocumentReference} ref - 문서 참조
   * @param {Object} data - 업데이트할 데이터
   * @returns {FirestoreBatch} 현재 인스턴스
   */
  update(ref, data) {
    return this.add(batch => batch.update(ref, data));
  }

  /**
   * 문서 삭제 작업 추가
   * @param {DocumentReference} ref - 문서 참조
   * @returns {FirestoreBatch} 현재 인스턴스
   */
  delete(ref) {
    return this.add(batch => batch.delete(ref));
  }

  /**
   * 모든 배치 작업 커밋
   * @returns {Promise<Array>} 각 배치 커밋 결과의 배열
   */
  async commit() {
    try {
      // 현재 배치도 커밋 대상에 추가
      if (this.operationCount > 0) {
        this.pendingCommits.push(this.batch);
      }

      // 커밋할 배치가 없는 경우
      if (this.pendingCommits.length === 0) {
        log('커밋할 작업 없음');
        return [];
      }

      log(`총 ${this.pendingCommits.length} 개의 배치 커밋 시작`);
      
      // 모든 배치 커밋 실행
      const results = await Promise.all(
        this.pendingCommits.map(batch => batch.commit())
      );

      log(`배치 커밋 성공: 총 ${this.pendingCommits.length} 배치`);
      
      // 상태 초기화
      this.pendingCommits = [];
      this.batch = writeBatch(firebasedb);
      this.operationCount = 0;
      
      return results;
    } catch (error) {
      handleFirestoreError(error, '배치 커밋 실패');
      throw error; // 오류 재전파
    }
  }

  /**
   * 현재 배치의 작업 수 반환
   * @returns {number} 현재 배치의 작업 수
   */
  get size() {
    return this.operationCount;
  }

  /**
   * 전체 배치 수 반환 (현재 배치 포함)
   * @returns {number} 전체 배치 수
   */
  get totalBatches() {
    return this.pendingCommits.length + (this.operationCount > 0 ? 1 : 0);
  }

  /**
   * 전체 작업 수 반환
   * @returns {number} 전체 작업 수
   */
  get totalOperations() {
    return this.pendingCommits.length * this.maxOperations + this.operationCount;
  }
}

/**
 * 새 FirestoreBatch 인스턴스 생성
 * @returns {FirestoreBatch} 새 FirestoreBatch 인스턴스
 */
export const createBatch = () => new FirestoreBatch();