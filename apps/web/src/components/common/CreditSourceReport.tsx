import { Box, Button, Stack, Typography } from '@mui/material';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link } from 'react-router-dom';
import { designTokens } from '../../theme';
import { webEnv } from '../../config/env';

type SourceReport = {
  originalFileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  reportDate: string | null;
  reportSource: string | null;
  contentPath: string;
};
const date = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not supplied';
export function CreditSourceReport({ report }: { report: SourceReport | null }) {
  return (
    <Box
      component="section"
      aria-label="Source report"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '220px minmax(0,1fr)' },
        border: 1,
        borderColor: 'divider',
        borderRadius: '24px',
        overflow: 'hidden',
        background: designTokens.gradient.data,
      }}
    >
      <Stack
        aria-hidden="true"
        sx={{
          p: { xs: 2, md: 4 },
          flexDirection: { xs: 'row', md: 'column' },
          gap: { xs: 2, md: 0 },
          alignItems: 'center',
          justifyContent: 'center',
          background: designTokens.gradient.advisory,
          color: designTokens.color.focusText,
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            width: 112,
            height: 144,
            bgcolor: '#ffffffb0',
            border: 1,
            borderColor: '#b5cbbd',
            borderRadius: '12px',
            p: 2,
            boxShadow: '0 14px 24px #153c3520',
            transform: 'rotate(-5deg)',
          }}
        >
          <DescriptionOutlined sx={{ fontSize: 44, color: '#24654f' }} />
          {[85, 100, 65].map((width, i) => (
            <Box
              key={i}
              sx={{ mt: 1.5, height: 5, width: `${width}%`, borderRadius: 1, bgcolor: '#b5cbbd' }}
            />
          ))}
        </Box>
        <DescriptionOutlined sx={{ display: { xs: 'block', md: 'none' }, fontSize: 28 }} />
        <Typography variant="overline" sx={{ mt: { xs: 0, md: 3 } }}>
          Source document
        </Typography>
      </Stack>
      <Stack spacing={3} sx={{ p: { xs: 3, md: 4 }, minWidth: 0 }}>
        <Box>
          <Typography variant="overline" color="primary">
            Credit Review evidence
          </Typography>
          <Typography variant="h2" sx={{ mt: 1 }}>
            Source report
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {report
              ? 'The report attached to this published Credit Review.'
              : 'No source report is attached to this publication.'}
          </Typography>
        </Box>
        {report ? (
          <>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {report.originalFileName}
            </Typography>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                gap: 3,
              }}
            >
              {[
                ['Report date', date(report.reportDate)],
                ['Added to workspace', date(report.uploadedAt)],
                ['Report source', report.reportSource || 'Not supplied'],
                [
                  'File size',
                  Number.isFinite(report.sizeBytes) && report.sizeBytes >= 0
                    ? `${(report.sizeBytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`
                    : 'Not supplied',
                ],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, mt: 0.5, overflowWrap: 'anywhere' }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box>
              <Button
                component="a"
                href={`${webEnv.VITE_API_URL}${report.contentPath}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                endIcon={<OpenInNewRounded />}
              >
                Preview secure source report
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Opens in a new tab. The report date shows the age of the source information.
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <Typography>
              Your published Profile and Analysis remain available. Ask about this review if you
              expected a report to be attached.
            </Typography>
            <Button
              component={Link}
              to="/app/credit-center/profile"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            >
              View published Profile
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
