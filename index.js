import fetch from 'node-fetch'

let accessToken = undefined
let refreshToken = undefined

const config = {
	server: "https://localhost:8043",
	cid: "",
	client_id: "",
	client_secret: "",
	site_id: "",
	aps: [],
	interval: 100000
}

async function authorize() {
    const url = `${config.server}/openapi/authorize/token?grant_type=client_credentials`
    const body = {
        omadacId: config.cid,
        client_id: config.client_id,
        client_secret: config.client_secret
    }

    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    })

    if (!res.ok) return false

    const data = await res.json()
    if (!data.errorCode === 0) return false

    accessToken = data.result.accessToken
    refreshToken = data.result.refreshToken
    return true
}

async function refresh() {
    const url = `${config.server}/openapi/authorize/token`
    const query = new URLSearchParams()
    query.append('grant_type', 'refresh_token')
    query.append('client_id', config.client_id)
    query.append('client_secret', config.client_secret)
    query.append('refresh_token', refreshToken)

    const res = await fetch(`${url}?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })

    if (!res.ok) return false
    const data = await res.json()
    if (!data.errorCode === 0) return false

    accessToken = data.result.accessToken
    refreshToken = data.result.refreshToken
    return true
}

async function checkAP(mac) {
    let url = `${config.server}/openapi/v1/${config.cid}/sites/${config.site_id}/aps/${mac}/radios`
    let res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'AccessToken=' + accessToken
        }
    })
    if (!res.ok) throw new Error(`Failed to fetch AP data: ${res.status} ${res.statusText}`)
    let data = await res.json()
    if (data.errorCode !== 0) throw new Error(`API error: ${data.msg}`)

    const actualChannel = data.result.wp5g.actualChannel.split(' ')[0]

    url = `${config.server}/openapi/v1/${config.cid}/sites/${config.site_id}/aps/${mac}/radio-config`
    res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'AccessToken=' + accessToken
        }
    })
    if (!res.ok) throw new Error(`Failed to fetch AP config: ${res.status} ${res.statusText}`)
    data = await res.json()
    if (data.errorCode !== 0) throw new Error(`API error: ${data.msg}`)
    
    const radioConfig = data.result
    const configuredChannelIdx = radioConfig.radioSetting5g.channel

    url = `${config.server}/openapi/v1/${config.cid}/sites/${config.site_id}/aps/${mac}/available-channel`
    res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'AccessToken=' + accessToken
        }
    })
    if (!res.ok) throw new Error(`Failed to fetch available channels: ${res.status} ${res.statusText}`)
    data = await res.json()
    if (data.errorCode !== 0) throw new Error(`API error: ${data.msg}`)

    let configuredChannel = null
    for (const chan of data.result[1].apChannelDetailList) {
        if (chan.index.toString() === configuredChannelIdx.toString())
            configuredChannel = chan.channel.toString()
    }
    if(configuredChannel === null) throw new Error(`Configured channel index ${configuredChannelIdx} not found in available channels`)

    if(actualChannel !== configuredChannel) {
        console.log(`${(new Date()).toISOString()} AP ${mac} is on channel ${actualChannel} but should be on ${configuredChannel}. Updating...`)
        url = `${config.server}/openapi/v1/${config.cid}/sites/${config.site_id}/aps/${mac}/radio-config`
        res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'AccessToken=' + accessToken
            },
            body: JSON.stringify(radioConfig)
        })

        if (!res.ok) throw new Error(`Failed to update AP config: ${res.status} ${res.statusText}`)
        data = await res.json()
        if (data.errorCode !== 0) throw new Error(`API error: ${data.msg}`)

        console.log(`AP ${mac} channel updated successfully.`)
    } else {
        //console.log(`AP ${mac} is on the correct channel ${actualChannel}. No update needed.`)
    }

}

async function run() {
    if (accessToken === undefined || refreshToken === undefined) {
        if(!(await authorize())) throw new Error('Authorization failed')
    }

    if(!(await refresh())) {
        if(!(await authorize())) throw new Error('Re-authorization failed')
    }

    for (const ap of config.aps) {
        try {
            await checkAP(ap)
        } catch (err) {
            console.error(`Error checking AP ${ap}: ${err.message}`)
        }
    }
}

function loadEnv() {
    if (process.env.CID) config.cid = process.env.CID
    else throw new Error('CID not set in environment variables')

    if (process.env.CLIENT_ID) config.client_id = process.env.CLIENT_ID
    else throw new Error('CLIENT_ID not set in environment variables')

    if (process.env.CLIENT_SECRET) config.client_secret = process.env.CLIENT_SECRET
    else throw new Error('CLIENT_SECRET not set in environment variables')

    if (process.env.SITE_ID) config.site_id = process.env.SITE_ID
    else throw new Error('SITE_ID not set in environment variables')

    if (process.env.APS) {
        config.aps = process.env.APS.split(',')
        if (config.aps.length === 0) throw new Error('APS environment variable is empty')
        for (const mac of config.aps) {
            if (!/^([0-9A-F]{2}-){5}([0-9A-F]{2})$/.test(mac))
                throw new Error(`${mac} not of form A1-B2-C3-D4-E5-F6`)
        }
    } else {
        throw new Error('APS not set in environment variables')
    }

    if (process.env.SERVER) config.server = process.env.SERVER

    if (process.env.INTERVAL) {
        const interval = parseInt(process.env.INTERVAL)
        if (isNaN(interval) || interval <= 0) throw new Error('INTERVAL must be a positive integer')
        config.interval = interval
    }
}

(async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    try {
	loadEnv()
        while (true) {
            run()
            await new Promise(resolve => setTimeout(resolve, config.interval))
        }
    } catch (err) {
        console.error(`Fatal error: ${err.message}`)
        process.exit(1)
    }
})()
