import React, { useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useDropzone } from 'react-dropzone'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { styled } from '@mui/material/styles'
import { CircularProgress } from '@mui/material'
import Typography from '@mui/material/Typography'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DescriptionIcon from '@mui/icons-material/Description'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import DoneIcon from '@mui/icons-material/Done';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import CheckIcon from '@mui/icons-material/Check'
import toast from 'react-hot-toast'
import axios from 'axios';
import { SERVER_URL } from 'src/configs/backend'
import { uploadCSV, addUploadingCsv, updateUploadingCsv, cleanUpUploadingCsvList } from 'src/store/apps/csv'
import { useChannel, useEvent } from "@harelpls/use-pusher";

const ContentWrapper = styled('main')(({ theme }) => ({
  width: '100%',
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  background: '#fff',
  zIndex: 9,
  maxWidth: '400px',
  borderRadius: '10px',
  boxShadow: '0px 2px 10px 0px rgba(20, 21, 33,  0.18)'
}))

const FileUpload = ({ handleFilter, value, handleExport, destination }) => {
  const userData = JSON.parse(window.localStorage.getItem('userData'))
  const loggedUserid = !!userData ? userData.id : 0;

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isUploadBoxVisible, setIsUploadBoxVisible] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('Uploading Item')
  const [message, setMessages] = useState()

  const channel = useChannel(`upload-${loggedUserid}-callCenter`);
  const eventName = `callCenter-${loggedUserid}-event`
  
  const [files, setFiles] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalSuccessRecords, setTotalSuccessRecords] = useState(0);
  const [totalFailedRecords, setTotalFailedRecords] = useState(0);

  useEvent(channel, eventName, ( data ) => {
    if (data) {
      const { fileID, progress } = data;
      setFiles(prevFiles => {
        return prevFiles.map(prevFile => {
          if (prevFile.fileID === fileID) {
            return {
              ...prevFile,
              progress: progress
            };
          }
          
          return prevFile;
        });
      });
      updateTotalRecords();
    }
  });

  const [uploadingCsvNumerics, setUploadingCsvNumerics] = useState({
    total: 0,
    success: 0,
    failed: 0
  })
  const { uploadingCsvList } = useSelector(state => state.csv)
  const dispatch = useDispatch()

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  const handleHideUploadBox = () => {
    setIsUploadBoxVisible(false)
    dispatch(cleanUpUploadingCsvList())
    setUploadingCsvNumerics({ total: 0, success: 0, failed: 0 })
  }

  const onDrop = useCallback(
    async acceptedFiles => {
      setIsUploadBoxVisible(true)
      acceptedFiles.forEach(async file => {
        setIsCollapsed(false)

        // New code by rishab
        const newFile = {
          fileID: Math.random().toString(36).substr(2, 9), // Generate a random fileID
          fileName: file.name,
          progress: 0,
          stage: "in-progress",
          records: {
            success: [],
            failed: []
          }
        };
        setFiles(prevFiles => [...prevFiles, newFile]);

        console.log("File ID: " + newFile.fileID); // Print the fileID

        let serverURL = ''

        switch (destination) {
          case 'call-center':
            serverURL = SERVER_URL + '/call_center/uploadCallCenterCSV'
            break
          case 'transaction-csv':
            serverURL = SERVER_URL + '/call_center/uploadTransactionCSV'
            break
          default:
            break
        }

        if (serverURL == '') return
        
        const reader = new FileReader()
        
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            const binaryStr = reader.result;
            const blob = new Blob([binaryStr]);
            const data = new FormData();
            data.append('csv', blob, file.name);
            data.append('fileID', newFile.fileID);

            try {
              const response = await axios.post(serverURL, data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: progressEvent => {}
              });
  
              setFiles(prevFiles => {
                return prevFiles.map(prevFile => {
                  if (prevFile.fileID === file.fileID) {
                    return {
                      ...prevFile,
                      progress: 100,
                      response: response.data
                    };
                  }

                  return prevFile;
                });
              });              
  
              resolve();
            } catch (error) {
              console.error('Error uploading file:', error);

              //reject(error);
            }
          };
  
          reader.readAsArrayBuffer(file);
        });  
        
        // End New code by rishab
        setUploadTitle('Uploading Item')
      })
    },
    [dispatch, destination, files]
  )

  // Update total success and failed records whenever a file's records change
  const updateTotalRecords = () => {
    let totalSuccess = 0;
    let totalFailed = 0;

    files.forEach(file => {
      totalSuccess += file.records.success.length;
      totalFailed += file.records.failed.length;
    });

    const total = totalSuccess + totalFailed;
    setTotalSuccessRecords(totalSuccess);
    setTotalFailedRecords(totalFailed);
    setTotalRecords(total);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: false })

  return (
    <React.Fragment>
      {destination && (
        <Stack direction='row' justifyContent='flex-end' alignItems='center' spacing={2} sx={{ mt: 5 }}>
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <Stack sx={{ mx: 6 }}>
              <Button
                component='label'
                variant='contained'
                sx={{ textTransform: 'none' }}
                htmlFor='account-settings-upload-csv'
                startIcon={<CloudUploadIcon />}
              >
                Upload CSV
              </Button>
            </Stack>
          </div>
        </Stack>
      )}

      {isUploadBoxVisible && (
        <ContentWrapper>
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            spacing={2}
            sx={{ background: '#f5f5f7' }}
          >
            <Box sx={{ fontWeight: 'medium', p: 4 }}>{uploadTitle}</Box>
            <div>
              <IconButton aria-label='Collapse' onClick={handleToggleCollapse}>
                {isCollapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              </IconButton>
              <IconButton aria-label='Cross' onClick={handleHideUploadBox}>
                <CloseIcon />
              </IconButton>
            </div>
          </Stack>
          {!isCollapsed && (
            <>
              <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={2}>
                <Typography variant='body2' sx={{ px: 4, py: 2 }}>
                  Total: {totalRecords}
                </Typography>
                <Typography variant='body2' sx={{ px: 4, py: 2 }}>
                  Success: {totalSuccessRecords}
                </Typography>
                <Typography variant='body2' sx={{ px: 4, py: 2 }}>
                  Failed: {totalFailedRecords}
                </Typography>
              </Stack>

              {files.map(file => (
                <Stack
                  key={file.fileID}
                  direction='row'
                  justifyContent='space-between'
                  alignItems='center'
                  spacing={2}
                  sx={{ p: 3 }}
                >
                  <div style={{ display: 'flex' }}>
                    <DescriptionIcon style={{ marginRight: '0.5em' }} />
                    <div
                      style={{
                        alignItems: 'center',
                        maxWidth: '270px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {file.fileName}
                    </div>
                  </div>

                  {file.progress > 0 ? (
                    <>
                      {file.stage == "failed" ? (
                        <CloseIcon style={{ color: '#ea4335' }} />
                      ) : (
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          {file.progress === 100 && !file.stage == "failed" ? 
                            <IconButton aria-label='Cross' disabled>
                              <DoneIcon style={{ color: '#34a853' }} />
                            </IconButton>
                          :
                            <>                         
                              <CircularProgress
                                variant='determinate'
                                value={file.progress}
                                style={{ color: file.progress === 100 ? (!csv.error ? '#34a853' : '#ea4335') : 'inherit' }}
                              />
                              <Box
                                sx={{
                                  top: 0,
                                  left: 0,
                                  bottom: 0,
                                  right: 0,
                                  position: 'absolute',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Typography
                                  variant='caption'
                                  component='div'
                                  color='text.secondary'
                                  sx={{ fontSize: 10, fontWeight: 'bold' }}
                                >
                                  {`${Math.round(file.progress)}%`}
                                </Typography>
                              </Box>
                            </>
                          }
                        </Box>
                      )}
                    </>
                  ) : file.stage == "failed" ? (
                    <>
                      <IconButton aria-label='Cross' disabled>
                        <CloseIcon style={{ color: '#ea4335' }} />
                      </IconButton>
                    </>
                  ) : null}

                </Stack>
              ))}
            </>
          )}
        </ContentWrapper>
      )}
    </React.Fragment>
  )
}

export default FileUpload
