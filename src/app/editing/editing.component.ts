import { HttpClient } from '@angular/common/http'
import { AfterViewInit, Component, OnDestroy, ViewEncapsulation } from '@angular/core'
import { RatingChangeEvent } from 'angular-star-rating'
import { NgxSpinnerService } from 'ngx-spinner'
import { Subscription, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import WaveSurfer from 'wavesurfer.js'
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline'

import { API_BASE_URL } from '@app/api-config'

interface Editing {
  uuid: string
  text_uuid: string
  media_uuid: string
  confidence_score: number
  edited_text: string
  mismatch: boolean
}

@Component({
  selector: 'app-editing',
  templateUrl: './editing.component.html',
  styleUrls: ['./editing.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class EditingComponent implements AfterViewInit, OnDestroy {
  private audioUrl = ''
  editedText = '\n'.repeat(199)
  private waveSurfer!: WaveSurfer
  isPlaying = false
  isWaveformVisible = false
  confidence_score = 1
  private confidenceScoreCounts: Record<string, number> = {}
  editingHistory: Editing[] = []
  currentEditingIndex = -1
  private currentTextUuid = ''
  private currentMediaUuid = ''
  private audioRequestSubscription: Subscription | null = null
  editorConfig = {
    lineNumbers: true,
    theme: 'juejin',
    mode: 'null',
    lineWrapping: true,
    readOnly: false,
  }

  constructor(
    private http: HttpClient,
    private spinner: NgxSpinnerService,
  ) {
    this.fetchAudioTextPair()
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.waveSurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
        // autoCenter: true,
        // autoScroll: true,
        autoplay: true,
        plugins: [
          TimelinePlugin.create({
            container: '#timeline',
          }),
          HoverPlugin.create({
            lineColor: '#34e1eb',
            lineWidth: 2,
            labelBackground: '#555',
            labelColor: '#fff',
            labelSize: '11px',
          }),
        ],
      })

      this.waveSurfer.on('finish', () => {
        this.isPlaying = false
      })

      this.spinner.show()
    }, 0)
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.waveSurfer.pause()
    } else {
      this.waveSurfer.play()
    }
    this.isPlaying = !this.isPlaying
  }

  fetchAudioTextPair() {
    // Reset the confidence score and edited text
    this.confidence_score = 1
    this.editedText = '\n'.repeat(199)

    this.fetchConfidenceScoreCounts()

    const url = `${API_BASE_URL}/get/audio_text_pair/`
    this.http
      .get<{ text: string; audio_uuid: string; text_uuid: string }>(url)
      .pipe(
        tap(response => {
          this.editedText = response.text
          this.currentTextUuid = response.text_uuid
          this.currentMediaUuid = response.audio_uuid

          // Save the new editing to the editing history with a placeholder UUID
          const newEditing: Editing = {
            uuid: '-1',
            text_uuid: response.text_uuid,
            media_uuid: response.audio_uuid,
            confidence_score: 1,
            edited_text: response.text,
            mismatch: false,
          }
          this.editingHistory.push(newEditing)
          this.currentEditingIndex = this.editingHistory.length - 1

          this.fetchAudioFile(response.audio_uuid)
        }),
        catchError(error => {
          console.error('Error fetching audio text pair:', error)
          return throwError(() => new Error('Error fetching audio text pair'))
        }),
      )
      .subscribe()
  }

  fetchAudioFile(audioUuid: string) {
    const audioUrl = `${API_BASE_URL}/get/audio/${audioUuid}`
    const waveformUrl = `${API_BASE_URL}/get/waveform/${audioUuid}`

    // Cancel the previous audio request if it exists
    if (this.audioRequestSubscription) {
      this.audioRequestSubscription.unsubscribe()
    }

    // First, get the audio file
    this.isWaveformVisible = false // Hide the waveform and show the spinner
    this.audioRequestSubscription = this.http
      .get(audioUrl, { responseType: 'blob' })
      .pipe(
        tap((audioBlob: Blob) => {
          this.audioUrl = URL.createObjectURL(audioBlob)

          // After fetching the audio, fetch the waveform data
          this.http.get<{ audio_uuid: string; waveform: string }>(waveformUrl).subscribe({
            next: waveformData => {
              this.waveSurfer.load(this.audioUrl, JSON.parse(waveformData.waveform)['data'])
              this.isPlaying = true
              this.isWaveformVisible = true // Show the waveform and hide the spinner after loading
            },
            error: error => {
              console.error('Error fetching waveform data:', error)
              // Fallback: Load only audio if waveform fetching fails
              this.waveSurfer.load(this.audioUrl)
              this.isPlaying = true
              this.isWaveformVisible = true // Show the waveform and hide the spinner after loading
            },
          })
        }),
        catchError(error => {
          console.error('Error fetching audio file:', error)
          this.isWaveformVisible = true // Show the waveform and hide the spinner on error
          return throwError(() => new Error('Error fetching audio file'))
        }),
      )
      .subscribe()
  }

  fetchConfidenceScoreCounts() {
    const url = `${API_BASE_URL}/get/confidence_score_counts/`
    this.http
      .get<Record<string, number>>(url)
      .pipe(
        tap(response => {
          this.confidenceScoreCounts = response
        }),
        catchError(error => {
          console.error('Error fetching confidence score counts:', error)
          return throwError(() => new Error('Error fetching confidence score counts'))
        }),
      )
      .subscribe()
  }

  formatConfidenceScoreCounts(): string {
    if (Object.keys(this.confidenceScoreCounts).length === 0) {
      return 'Loading...'
    }

    const maxStars = 5 // Maximum number of stars

    // Use a new object to avoid mutating the original object
    const scoresCopy = { ...this.confidenceScoreCounts }

    // Extract the total count and mismatch count from the copy
    const total = scoresCopy['total'] || 0 // Default to 0 if 'total' is undefined
    delete scoresCopy['total'] // Remove the 'total' key from the copy
    const mismatchCount = scoresCopy['mismatch'] || 0 // Default to 0 if 'mismatch' is undefined
    delete scoresCopy['mismatch'] // Remove the 'mismatch' key from the copy

    const formattedCounts = Object.entries(scoresCopy)
      .map(([score, count]) => {
        const stars = '★'.repeat(parseInt(score, 10))
        const spaces = ' '.repeat(maxStars - stars.length)
        return `${stars}:${spaces}${count}`
      })
      .join(' | ')

    return `Total: ${total} | Mismatch: ${mismatchCount} | ${formattedCounts}`
  }

  onRatingChange(event: RatingChangeEvent) {
    console.log('Rating changed:', event)
    this.confidence_score = event.rating
    // console.log(this.editingHistory)
    // console.log(this.currentEditingIndex)
  }

  submitEditing() {
    const currentEditing = this.editingHistory[this.currentEditingIndex]
    const editing: Editing = {
      uuid: currentEditing?.uuid || '',
      text_uuid: currentEditing?.text_uuid || this.currentTextUuid,
      media_uuid: currentEditing?.media_uuid || this.currentMediaUuid,
      confidence_score: this.confidence_score,
      edited_text: this.editedText,
      mismatch: false,
    }

    let url = `${API_BASE_URL}/add/editing/`
    let method: 'put' | 'post' = 'put'

    if (currentEditing?.uuid !== '-1') {
      // If the current editing has a UUID other than '-1', update the existing editing
      url = `${API_BASE_URL}/update/editing/${currentEditing.uuid}`
      method = 'post'
    }

    this.http
      .request<{ uuid: string }>(method, url, { body: editing })
      .pipe(
        tap(response => {
          console.log('Editing submitted successfully:', response)
          if (currentEditing?.uuid === '-1') {
            // If it's a new editing with a placeholder UUID, replace it with the real UUID
            this.editingHistory[this.currentEditingIndex].uuid = response.uuid
          } else {
            // If it's an update, update the fields in the history
            this.editingHistory[this.currentEditingIndex] = {
              ...currentEditing,
              confidence_score: this.confidence_score,
              edited_text: this.editedText,
            }
          }
          // Fetch a new audio-text pair after submitting the editing
          this.fetchAudioTextPair()
        }),
        catchError(error => {
          console.error('Error submitting editing:', error)
          return throwError(() => new Error('Error submitting editing'))
        }),
      )
      .subscribe()
  }

  skipEditing() {
    // Fetch a new audio-text pair
    this.fetchAudioTextPair()
  }

  markAsMismatch() {
    const currentEditing = this.editingHistory[this.currentEditingIndex]
    const editing: Editing = {
      uuid: currentEditing?.uuid || '',
      text_uuid: currentEditing?.text_uuid || this.currentTextUuid,
      media_uuid: currentEditing?.media_uuid || this.currentMediaUuid,
      confidence_score: this.confidence_score,
      edited_text: this.editedText,
      mismatch: true,
    }

    let url = `${API_BASE_URL}/add/editing/`
    let method: 'put' | 'post' = 'put'

    if (currentEditing?.uuid && currentEditing.uuid !== '-1') {
      // If the current editing has a valid UUID (not '-1'), update the existing editing
      url = `${API_BASE_URL}/update/editing/${currentEditing.uuid}`
      method = 'post'
    }

    this.http
      .request<{ uuid: string }>(method, url, { body: editing })
      .pipe(
        tap(response => {
          console.log('Editing marked as mismatch:', response)
          if (currentEditing?.uuid === '-1') {
            // If it's a new editing with a placeholder UUID, replace it with the real UUID
            this.editingHistory[this.currentEditingIndex].uuid = response.uuid
          } else {
            // If it's an update, update the fields in the history
            this.editingHistory[this.currentEditingIndex] = {
              ...currentEditing,
              mismatch: true,
            }
          }
          // Fetch a new audio-text pair
          this.fetchAudioTextPair()
        }),
        catchError(error => {
          console.error('Error marking editing as mismatch:', error)
          return throwError(() => new Error('Error marking editing as mismatch'))
        }),
      )
      .subscribe()
  }

  goBack() {
    if (this.currentEditingIndex > 0) {
      this.currentEditingIndex--
      this.loadEditing(this.editingHistory[this.currentEditingIndex])
    }
  }

  goForward() {
    if (this.currentEditingIndex < this.editingHistory.length - 1) {
      this.currentEditingIndex++
      this.loadEditing(this.editingHistory[this.currentEditingIndex])
    }
  }

  loadEditing(editing: Editing) {
    this.editedText = editing.edited_text
    this.confidence_score = editing.confidence_score
    this.currentTextUuid = editing.text_uuid
    this.currentMediaUuid = editing.media_uuid
    this.fetchAudioFile(editing.media_uuid)
  }

  ngOnDestroy() {
    if (this.waveSurfer) {
      this.waveSurfer.destroy()
    }

    // Unsubscribe from the audio request subscription
    if (this.audioRequestSubscription) {
      this.audioRequestSubscription.unsubscribe()
    }
  }

  protected readonly events = module
}
