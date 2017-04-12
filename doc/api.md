emulex-server
===


## Http
all http api response is defined by code/msg. the code is 0 when call api is success, other is fail and the msg is the error message.


### `/exec/add_task`
add task to download

**Arguments**

* `hash` the file hash
* `filename` the file name
* `location` the file location to save.
* `size` the file size.

**Reponse**

* `tid` the added task id.

fail response

```.json
{
	"code": 1,
	"msg": "hash argument is required"
}
```

success response

```.json
{
	"code": 0,
	"msg": "OK",
	"tid": 1
}
```

### `/exec/pause_task`
puase task, it will notify by websocket and pasue task is done.

**Arguments**

* `hash` the file hash

**Reponse**

* common code/data response

fail response

```.json
{
	"code": 1,
	"msg": "hash argument is required"
}
```

success response

```.json
{
	"code": 0,
	"msg": "OK"
}
```

### `/exec/resume_task`
resume task, it will notify by websocket and pasue task is done.

**Arguments**

* `hash` the file hash

**Reponse**

* common code/data response

fail response

```.json
{
	"code": 1,
	"msg": "hash argument is required"
}
```

success response

```.json
{
	"code": 0,
	"msg": "OK"
}
```

### `/exec/remove_task`
remove task, it will notify by websocket and pasue task is done.

**Arguments**

* `hash` the file hash

**Reponse**

* common code/data response

fail response

```.json
{
	"code": 1,
	"msg": "hash argument is required"
}
```

success response

```.json
{
	"code": 0,
	"msg": "OK"
}
```

### `/exec/list_task`
list all task

**Arguments**

* `status` the task status is on 100/120/200, split by comma.
  * `100` the task is downloading
  * `120` the task is paused.
  * `200` the task is done.

**Reponse**

* the response is same of `/exec/search_file`

fail response

```.json
{
	"code": 1,
	"msg": "system error"
}
```

success response

```.json
{
	"code": 0,
	"tasks": [
		{
			"tid": 2,
			"sha": null,
			"md5": null,
			"emd4": "0C2BE0003F0DEBDCF644525BDAF6E45D",
			"filename": "abc.txt",
			"size": 7,
			"format": ".txt",
			"location": ".",
			"duration": null,
			"bitrate": null,
			"codec": null,
			"authors": null,
			"description": null,
			"album": null,
			"done": 0,
			"used": 0,
			"task": 1,
			"status": 200
		}
	],
	"msg": "OK"
}
```

### `/exec/search_file`
search file

**Arguments**

* `query` the key string to search
* `format` the file extension
* `delay` the delay millseconds for waiting the remote server responsed
* `remote` whether wait remote server responsed, 1 is waiting, 0 is not.

**Reponse**

* `tid` the file id
* `sha` the file sha
* `md5` the file md5
* `emd4` the file ed2k md4
* `filename` the file name
* `size` the file size
* `format` the file extension
* `location` the file saved location
* `duration` the media duration
* `bitrate` the media bitrate
* `codec` the media codec
* `authors` the media author
* `album` the media album
* `done` the size of transftered
* `used` the time of transfter used.
* `task` whether the file is task.
* `status` the file status is on 100/200/300
  * `100` the file is downloading
  * `200` the file is donwloaded.
  * `300` the file is other shared.

fail response

```.json
{
	"code": 1,
	"msg": "system error"
}
```

success response

```.json
{
	"code": 0,
	"fs": [
		{
			"tid": 2,
			"sha": null,
			"md5": null,
			"emd4": "0C2BE0003F0DEBDCF644525BDAF6E45D",
			"filename": "abc.txt",
			"size": 7,
			"format": ".txt",
			"location": ".",
			"duration": null,
			"bitrate": null,
			"codec": null,
			"authors": null,
			"description": null,
			"album": null,
			"done": 0,
			"used": 0,
			"task": 1,
			"status": 200
		}
	],
	"msg": "OK"
}
```


### `/exec/add_server`
add server to db

**Arguments**

* `name` the server name
* `addr` the server address
* `port` the server port.
* `type` the server type on 100
  * `100` the ed2k server type.

**Reponse**

* `tid` the added task id.

fail response

```.json
{
	"code": 1,
	"msg": "name argument is required"
}
```

success response

```.json
{
	"code": 0,
	"msg": "OK",
	"tid": 1
}
```

### `/exec/list_task`
list all task

**Arguments**

* not arguments

**Reponse**

* `name` the server name
* `addr` the server address
* `port` the server port.
* `type` the server type on 100
  * `100` the ed2k server type.
* `description` the server description
* `tryc` the connected times.
* `last` the last connected time.

fail response

```.json
{
	"code": 1,
	"msg": "system error"
}
```

success response

```.json
{
	"code": 0,
	"servers": [
		{
			"tid": 1,
			"name": "testing",
			"addr": "a.loc.w",
			"port": 4122,
			"type": 100,
			"description": "description",
			"tryc": 0,
			"last": 0
		}
	],
	"msg": 'OK'
}
```

## Websocket

### `ed2k_initialized`
the ed2k server is initialized.

**Arguments**

* not arguments

### `file_found`
the remote search request is back.

**Arguments**

* not arguments

### `transfer_status`
the transfer task is finished.

**Arguments**

* `name` the file name
* `save_path` the save location.
* `emd4` the ed2k md4 hash.
* `size` the file size.
* `status` the task status is on 100/120/200/-1.
  * `100` the task is downloading
  * `120` the task is paused.
  * `200` the task is done.
  * `-1` the task is removed.

```.json
{
	"type": "finished_transfer",
	"name": "abc.txt",
	"save_path": ".",
	"emd4": "0C2BE0003F0DEBDCF644525BDAF6E45D",
	"size": 7,
	"status": 100
}
```
