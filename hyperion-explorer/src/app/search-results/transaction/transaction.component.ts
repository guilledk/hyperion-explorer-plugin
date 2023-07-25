import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons/faExchangeAlt';
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle';
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock';
import { faHourglassStart } from '@fortawesome/free-solid-svg-icons/faHourglassStart';
import { faHistory } from '@fortawesome/free-solid-svg-icons/faHistory';
import { faSadTear } from '@fortawesome/free-solid-svg-icons/faSadTear';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';
import { ChainService } from '../../services/chain.service';
import { Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { timestamp } from 'rxjs/operators';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent implements OnInit, OnDestroy {
  columnsToDisplay: string[] = ['contract', 'action', 'data', 'auth'];
  tx: any = {
    actions: null
  };
  faCircle = faCircle;
  faExchange = faExchangeAlt;
  faLock = faLock;
  faHourglass = faHourglassStart;
  faHistory = faHistory;
  faSadTear = faSadTear;
  faSpinner = faSpinner;
  txID: string;
  countdownLoop: any;
  countdownTimer = 0;
  ipfsImageUrl: string;
  ipfsInputImageUrl: string;
  inputTxUrl: string;
  inputTxText: string;
  hasImage: boolean
  hasInputImage: boolean

  objectKeyCount(obj): number {
    try {
      return Object.keys(obj).length;
    } catch (e) {
      return 0;
    }
  }

  constructor(private activatedRoute: ActivatedRoute,
    public accountService: AccountService,
    public chainData: ChainService,
    private title: Title) {
  }

  openImage() {
    window.open(this.ipfsImageUrl, '_blank');
  }

  openInputImage() {
    window.open(this.ipfsInputImageUrl, '_blank');
  }

  getPrettyJson(value: any){
    return JSON.stringify(JSON.parse(value), null, 2)
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(async (routeParams) => {
      this.txID = routeParams.transaction_id;
      this.tx = await this.accountService.loadTxData(routeParams.transaction_id);
      const inputTxId = await this.findEnqueueTXId(routeParams.transaction_id);
      const inputTx = await this.accountService.loadTxData(inputTxId);
      if (inputTx.actions[0].act.data.binary_data) {
        this.inputTxText = JSON.parse(inputTx.actions[0].act.data.request_body).params.prompt;
        this.inputTxUrl = `${environment.hyperionApiUrl}/v2/explore/transaction/${inputTxId}`
        this.ipfsInputImageUrl = `${environment.ipfsUrl}${inputTx.actions[0].act.data.binary_data}/image.png`
        this.hasInputImage = true
      }
      else {
        this.inputTxText = JSON.parse(inputTx.actions[0].act.data.request_body).params.prompt;
        this.inputTxUrl = `${environment.hyperionApiUrl}/v2/explore/transaction/${inputTxId};`
        this.hasInputImage = false
      }

      if (this.tx.actions[0].act.data.ipfs_hash) {
        this.ipfsImageUrl = this.tx.actions[0].act.data.ipfs_hash
        this.ipfsImageUrl = `${environment.ipfsUrl}${this.ipfsImageUrl}/image.png`
        this.hasImage = true
      }
      else {
        this.hasImage = false
      }

      if (!this.chainData.chainInfoData.chain_name) {
        this.title.setTitle(`TX ${routeParams.transaction_id.slice(0, 8)} • Hyperion Explorer`);
      } else {
        this.title.setTitle(`TX ${routeParams.transaction_id.slice(0, 8)} • ${this.chainData.chainInfoData.chain_name} Hyperion Explorer`);
      }

      this.accountService.libNum = this.tx.lib;
      if (this.tx.actions[0].block_num > this.tx.lib) {
        await this.reloadCountdownTimer();
        this.countdownLoop = setInterval(async () => {
          this.countdownTimer--;
          if (this.countdownTimer <= 0) {
            await this.reloadCountdownTimer();
            if (this.accountService.libNum > this.tx.actions[0].block_num) {
              clearInterval(this.countdownLoop);
            }
          }
        }, 1000);
      }
    });
  }


  async hashRequest(data) {
    // Combine all parts of the data into a single string.
    const combinedData = `${data.nonce}${data.body}${data.binary_data}`;

    // Encode combinedData to UTF-8 and hash it.
    const encodedData = new TextEncoder().encode(combinedData);
    const hash = await window.crypto.subtle.digest('SHA-256', encodedData);

    // Convert the hash (a byte array) to a hexadecimal string and uppercase it.
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  async fetchTransaction(txId: string) {
    try {
      const response = await fetch(`${environment.hyperionApiUrl}/v2/history/get_transaction?id=${txId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async findEnqueueTXId(submitTx: string) {

    const submitData = await this.fetchTransaction(submitTx);
    const submitAction = submitData.actions[0];

    const requestHash = submitAction.act.data.request_hash;

    let startDate = new Date(submitAction.timestamp + 'Z');
    startDate.setSeconds(startDate.getSeconds() - 1);

    console.log(requestHash, startDate);

    const msInAnHour = 60 * 60 * 1000; // milliseconds in an hour
    const maxRequests = 3;

    let before = startDate.getTime(); // convert startDate to ms since epoch
    let after = before - msInAnHour;

    for (let requestCounter = 0; requestCounter < maxRequests; requestCounter++) {
      try {
        const url = `${environment.hyperionApiUrl}/v2/history/get_deltas?code=telos.gpu&scope=telos.gpu&table=queue&sort=desc&before=${new Date(before).toISOString()}&after=${new Date(after).toISOString()}`;

        const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        console.log(response);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        let matchDelta = null;

        // Find a delta with a matching hash using for-of loop.
        for (const delta of data.deltas) {
          const hash = await this.hashRequest(delta.data);
          if (hash === requestHash) {
            matchDelta = delta;
            break;
          }
        }

        if (!matchDelta) {
          before -= msInAnHour;
          after -= msInAnHour;
          continue;
        }

        const matchBlock = await this.accountService.loadBlockDataByNumber(matchDelta.block_num);
        const nonces = await this.accountService.getBlockNonces(matchBlock.timestamp);

        // Find a transaction with a matching hash.

        for (const tx of matchBlock.transactions) {
          console.log(tx);
          for (const action of tx.trx.transaction.actions) {
            console.log(action);
            let foundNonce = null;
            // Find nonce with matching hash using for-of loop.
            for (const n of nonces) {
              const hash = await this.hashRequest({
                nonce: (parseInt(n) - 1).toString(),
                body: action.data.request_body,
                binary_data: action.data.binary_data
              });

              if (hash === requestHash) {
                foundNonce = n;
                break;
              }
            }
            console.log(foundNonce);
            if (foundNonce) return tx.trx.id;
          }
        }
      } catch (error) {
        console.error('Error:', error);
        break;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.countdownLoop) {
      clearInterval(this.countdownLoop);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  async reloadCountdownTimer(): Promise<void> {
    await this.accountService.updateLib();
    this.countdownTimer = Math.ceil((this.tx.actions[0].block_num - this.accountService.libNum) / 2);
  }
}
